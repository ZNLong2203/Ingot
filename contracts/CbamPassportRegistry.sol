// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title CbamPassportRegistry
/// @notice Verified embedded-emissions statements for EU CBAM goods, and the
/// flow of each verified tonne through the supply chain to exactly one end:
/// a CBAM declaration at the EU border, or consumption as a precursor in a
/// downstream installation.
///
/// Four doors are closed here:
///   1. Production: statements for one installation and CN code may not cover
///      overlapping periods, so a tonne cannot be verified twice.
///   2. Supply: allocations from a statement never exceed its verified
///      quantity, and a shipment reference is used once.
///   3. Demand: an allocation ends exactly once, declared or consumed.
///   4. Laundering: a downstream statement must carry the embedded emissions
///      of the precursor allocations it consumes. The registry recomputes that
///      sum from the upstream statements and refuses a statement whose total
///      embedded emissions are below it.
///
/// Only commitments go on chain. The full emissions report stays with the
/// operator and verifier; its fields are committed to `evidenceRoot`, a Merkle
/// root of salted leaves, so a single field can later be disclosed and proven
/// with `verifyDisclosure` without revealing the rest.
contract CbamPassportRegistry is EIP712 {
    // ─── Types ──────────────────────────────────────────────────────────────

    struct Attestation {
        bytes32 installationId;
        uint32 cnCode; // 8-digit Combined Nomenclature code, e.g. 72083900
        uint32 periodStart; // unix seconds, inclusive
        uint32 periodEnd; // unix seconds, exclusive
        uint64 quantityKg; // goods produced in the period and covered here
        uint32 directKgPerTonne; // specific direct embedded emissions, precursors included
        uint32 indirectKgPerTonne; // specific indirect embedded emissions, precursors included
        uint32 carbonPriceCentsPerTonne; // carbon price effectively paid at origin, EUR cents per tonne of good
        bytes32 evidenceRoot; // Merkle root of the salted report fields
        bytes32 inputsHash; // keccak256(abi.encode(bytes32[] precursor allocation ids))
        uint64 precursorDirectKg; // embedded direct emissions of those precursors
        uint64 precursorIndirectKg; // embedded indirect emissions of those precursors
        uint40 deadline; // the signature is void after this time
    }

    struct Statement {
        bytes32 installationId;
        uint32 cnCode;
        uint32 periodStart;
        uint32 periodEnd;
        uint64 quantityKg;
        uint64 allocatedKg;
        uint32 directKgPerTonne;
        uint32 indirectKgPerTonne;
        uint32 carbonPriceCentsPerTonne;
        uint64 precursorDirectKg;
        uint64 precursorIndirectKg;
        bytes32 evidenceRoot;
        bytes32 inputsHash;
        address verifier;
        uint40 attestedAt;
        bool revoked;
    }

    enum AllocationStatus {
        None,
        Open,
        Declared,
        Consumed
    }

    struct Allocation {
        bytes32 statementId;
        address recipient; // an EU declarant, or the operator of a downstream installation
        uint64 quantityKg;
        bytes32 shipmentRef; // hash of the customs movement reference (MRN) or delivery note
        uint40 createdAt;
        AllocationStatus status;
        bytes32 spentIn; // declaration reference, or the downstream statement id
    }

    struct Installation {
        address operator;
        bytes2 country; // ISO 3166-1 alpha-2
        bytes32 metadataHash; // hash of the public installation record
        address registeredBy;
    }

    struct Verifier {
        string name;
        uint40 accreditedUntil;
        bool suspended;
    }

    bytes32 public constant ATTESTATION_TYPEHASH = keccak256(
        "Attestation(bytes32 installationId,uint32 cnCode,uint32 periodStart,uint32 periodEnd,uint64 quantityKg,uint32 directKgPerTonne,uint32 indirectKgPerTonne,uint32 carbonPriceCentsPerTonne,bytes32 evidenceRoot,bytes32 inputsHash,uint64 precursorDirectKg,uint64 precursorIndirectKg,uint40 deadline)"
    );

    // ─── State ──────────────────────────────────────────────────────────────

    address public authority;

    mapping(address => Verifier) public verifiers;
    /// @dev keccak256 of each verifier's ML-DSA-65 (FIPS 204) public key. Passports
    /// carry a post-quantum co-signature over the statement id; this binds the
    /// key that must have made it, so the attestation survives a future break of ECDSA.
    mapping(address => bytes32) public pqKeyHash;
    mapping(bytes32 => Installation) public installations;
    mapping(bytes32 => Statement) private _statements;
    mapping(bytes32 => Allocation) private _allocations;
    mapping(bytes32 => bytes32[]) private _statementInputs;

    /// @dev End of the latest live statement per installation and CN code.
    mapping(bytes32 => mapping(uint32 => uint32)) public coveredUntil;
    /// @dev The statement that set `coveredUntil`, so revoking it can reopen the period.
    mapping(bytes32 => mapping(uint32 => bytes32)) public latestStatement;
    /// @dev The live statement before this one for the same installation and CN code.
    mapping(bytes32 => bytes32) public previousStatement;
    /// @dev The allocation that holds a shipment reference. A reference is free
    /// again once that allocation's statement is withdrawn, so a corrected
    /// statement can cover the same shipment.
    mapping(bytes32 => bytes32) public shipmentAllocation;

    bytes32[] public statementIds;
    bytes32[] public allocationIds;

    // ─── Events ─────────────────────────────────────────────────────────────

    event AuthorityTransferred(address indexed from, address indexed to);
    event VerifierAccredited(address indexed verifier, string name, uint40 accreditedUntil);
    event VerifierSuspended(address indexed verifier);
    event VerifierPqKeySet(address indexed verifier, bytes32 keyHash);
    event InstallationRegistered(
        bytes32 indexed installationId, address indexed operator, bytes2 country, address indexed registeredBy
    );
    event StatementAttested(
        bytes32 indexed statementId,
        bytes32 indexed installationId,
        address indexed verifier,
        uint32 cnCode,
        uint64 quantityKg,
        uint32 directKgPerTonne,
        uint32 indirectKgPerTonne,
        uint256 inputCount
    );
    event StatementRevoked(bytes32 indexed statementId, address indexed by, bytes32 reasonHash);
    event Allocated(
        bytes32 indexed allocationId,
        bytes32 indexed statementId,
        address indexed recipient,
        uint64 quantityKg,
        bytes32 shipmentRef
    );
    event Declared(bytes32 indexed allocationId, address indexed declarant, bytes32 declarationRef);
    event Consumed(bytes32 indexed allocationId, bytes32 indexed intoStatementId);
    event Reopened(bytes32 indexed allocationId, bytes32 indexed fromStatementId);

    // ─── Errors ─────────────────────────────────────────────────────────────

    error NotAuthority();
    error NotAccreditedVerifier(address account);
    error NotOperator(bytes32 installationId, address account);
    error NotRecipient(bytes32 allocationId, address account);
    error NotStatementVerifier(bytes32 statementId, address account);
    error InstallationExists(bytes32 installationId);
    error UnknownInstallation(bytes32 installationId);
    error UnknownStatement(bytes32 statementId);
    error UnknownAllocation(bytes32 allocationId);
    error SignatureExpired(uint40 deadline);
    error InvalidPeriod(uint32 periodStart, uint32 periodEnd);
    error PeriodOverlaps(uint32 periodStart, uint32 coveredUntil);
    error ZeroQuantity();
    error ZeroRecipient();
    error ZeroAddress();
    error SelfAttestation(address verifier);
    error FuturePeriod(uint32 periodEnd);
    error StatementExists(bytes32 statementId);
    error StatementIsRevoked(bytes32 statementId);
    error ExceedsVerifiedQuantity(bytes32 statementId, uint64 availableKg, uint64 requestedKg);
    error ShipmentAlreadyAllocated(bytes32 shipmentRef);
    error AllocationNotOpen(bytes32 allocationId, AllocationStatus status);
    error InputsMismatch(bytes32 signed, bytes32 supplied);
    error PrecursorEmissionsMismatch(uint64 directKg, uint64 indirectKg, uint64 expectedDirectKg, uint64 expectedIndirectKg);
    error BelowPrecursorEmissions(uint256 totalDirectKg, uint64 precursorDirectKg);
    error BelowPrecursorIndirectEmissions(uint256 totalIndirectKg, uint64 precursorIndirectKg);

    // ─── Setup ──────────────────────────────────────────────────────────────

    constructor(address authority_) EIP712("CbamPassportRegistry", "1") {
        authority = authority_;
        emit AuthorityTransferred(address(0), authority_);
    }

    modifier onlyAuthority() {
        if (msg.sender != authority) revert NotAuthority();
        _;
    }

    function transferAuthority(address to) external onlyAuthority {
        if (to == address(0)) revert ZeroAddress();
        emit AuthorityTransferred(authority, to);
        authority = to;
    }

    /// @notice The accreditation body admits a verifier until a given time.
    function accreditVerifier(address verifier, string calldata name, uint40 accreditedUntil) external onlyAuthority {
        verifiers[verifier] = Verifier({name: name, accreditedUntil: accreditedUntil, suspended: false});
        emit VerifierAccredited(verifier, name, accreditedUntil);
    }

    /// @notice The authority binds a verifier's post-quantum public key (its hash).
    function setVerifierPqKey(address verifier, bytes32 keyHash) external onlyAuthority {
        pqKeyHash[verifier] = keyHash;
        emit VerifierPqKeySet(verifier, keyHash);
    }

    function suspendVerifier(address verifier) external onlyAuthority {
        verifiers[verifier].suspended = true;
        emit VerifierSuspended(verifier);
    }

    function isAccredited(address account) public view returns (bool) {
        Verifier storage v = verifiers[account];
        return !v.suspended && v.accreditedUntil >= block.timestamp;
    }

    /// @notice A verifier who has checked the monitoring plan on site registers
    /// the installation and binds it to the operator's account.
    function registerInstallation(bytes32 installationId, address operator, bytes2 country, bytes32 metadataHash)
        external
    {
        if (!isAccredited(msg.sender)) revert NotAccreditedVerifier(msg.sender);
        if (operator == address(0)) revert ZeroAddress();
        if (installations[installationId].operator != address(0)) revert InstallationExists(installationId);
        installations[installationId] =
            Installation({operator: operator, country: country, metadataHash: metadataHash, registeredBy: msg.sender});
        emit InstallationRegistered(installationId, operator, country, msg.sender);
    }

    // ─── Statements ─────────────────────────────────────────────────────────

    function hashAttestation(Attestation calldata a) public view returns (bytes32) {
        bytes memory head = abi.encode(
            ATTESTATION_TYPEHASH,
            a.installationId,
            a.cnCode,
            a.periodStart,
            a.periodEnd,
            a.quantityKg,
            a.directKgPerTonne,
            a.indirectKgPerTonne
        );
        bytes memory tail = abi.encode(
            a.carbonPriceCentsPerTonne,
            a.evidenceRoot,
            a.inputsHash,
            a.precursorDirectKg,
            a.precursorIndirectKg,
            a.deadline
        );
        return _hashTypedDataV4(keccak256(bytes.concat(head, tail)));
    }

    /// @notice The operator records a statement that an accredited verifier
    /// signed off chain (EIP-712), consuming the precursor allocations it was
    /// built on. The signature travels with the passport, so anyone can check
    /// it without trusting the operator.
    function submitStatement(Attestation calldata a, bytes calldata signature, bytes32[] calldata inputs)
        external
        returns (bytes32 statementId)
    {
        _checkHeader(a);

        statementId = hashAttestation(a);
        // A revoked statement reopens its period, but the same signed
        // attestation must not come back with its allocations reset.
        if (_statements[statementId].verifier != address(0)) revert StatementExists(statementId);
        address signer = ECDSA.recover(statementId, signature);
        if (!isAccredited(signer)) revert NotAccreditedVerifier(signer);
        if (signer == msg.sender) revert SelfAttestation(signer);

        _consumeInputs(a, inputs, statementId);

        Statement storage s = _statements[statementId];
        s.installationId = a.installationId;
        s.cnCode = a.cnCode;
        s.periodStart = a.periodStart;
        s.periodEnd = a.periodEnd;
        s.quantityKg = a.quantityKg;
        s.directKgPerTonne = a.directKgPerTonne;
        s.indirectKgPerTonne = a.indirectKgPerTonne;
        s.carbonPriceCentsPerTonne = a.carbonPriceCentsPerTonne;
        s.precursorDirectKg = a.precursorDirectKg;
        s.precursorIndirectKg = a.precursorIndirectKg;
        s.evidenceRoot = a.evidenceRoot;
        s.inputsHash = a.inputsHash;
        s.verifier = signer;
        s.attestedAt = uint40(block.timestamp);

        coveredUntil[a.installationId][a.cnCode] = a.periodEnd;
        previousStatement[statementId] = latestStatement[a.installationId][a.cnCode];
        latestStatement[a.installationId][a.cnCode] = statementId;
        statementIds.push(statementId);
        _statementInputs[statementId] = inputs;

        emit StatementAttested(
            statementId,
            a.installationId,
            signer,
            a.cnCode,
            a.quantityKg,
            a.directKgPerTonne,
            a.indirectKgPerTonne,
            inputs.length
        );
    }

    function _checkHeader(Attestation calldata a) private view {
        Installation storage inst = installations[a.installationId];
        if (inst.operator == address(0)) revert UnknownInstallation(a.installationId);
        if (msg.sender != inst.operator) revert NotOperator(a.installationId, msg.sender);
        if (block.timestamp > a.deadline) revert SignatureExpired(a.deadline);
        if (a.periodEnd <= a.periodStart) revert InvalidPeriod(a.periodStart, a.periodEnd);
        // Only finished periods can be verified, so a far-future end cannot block the calendar.
        if (a.periodEnd > block.timestamp) revert FuturePeriod(a.periodEnd);
        if (a.quantityKg == 0) revert ZeroQuantity();
        uint32 covered = coveredUntil[a.installationId][a.cnCode];
        if (a.periodStart < covered) revert PeriodOverlaps(a.periodStart, covered);
    }

    /// @dev Recomputes the embedded emissions of the precursors from the
    /// upstream statements, checks them against what the verifier signed, and
    /// marks every input allocation consumed by this statement.
    function _consumeInputs(Attestation calldata a, bytes32[] calldata inputs, bytes32 statementId) private {
        bytes32 supplied = keccak256(abi.encode(inputs));
        if (supplied != a.inputsHash) revert InputsMismatch(a.inputsHash, supplied);

        uint256 directScaled; // kg of good x kg CO2e per tonne, divided by 1000 at the end
        uint256 indirectScaled;
        for (uint256 i = 0; i < inputs.length; i++) {
            Allocation storage al = _allocation(inputs[i]);
            if (al.recipient != msg.sender) revert NotRecipient(inputs[i], msg.sender);
            if (al.status != AllocationStatus.Open) revert AllocationNotOpen(inputs[i], al.status);
            Statement storage up = _statements[al.statementId];
            if (up.revoked) revert StatementIsRevoked(al.statementId);
            directScaled += uint256(al.quantityKg) * up.directKgPerTonne;
            indirectScaled += uint256(al.quantityKg) * up.indirectKgPerTonne;
            al.status = AllocationStatus.Consumed;
            al.spentIn = statementId;
            emit Consumed(inputs[i], statementId);
        }

        uint64 expectedDirect = SafeCast.toUint64(directScaled / 1000);
        uint64 expectedIndirect = SafeCast.toUint64(indirectScaled / 1000);
        if (a.precursorDirectKg != expectedDirect || a.precursorIndirectKg != expectedIndirect) {
            revert PrecursorEmissionsMismatch(a.precursorDirectKg, a.precursorIndirectKg, expectedDirect, expectedIndirect);
        }
        uint256 totalDirect = uint256(a.directKgPerTonne) * a.quantityKg / 1000;
        if (totalDirect < a.precursorDirectKg) revert BelowPrecursorEmissions(totalDirect, a.precursorDirectKg);
        uint256 totalIndirect = uint256(a.indirectKgPerTonne) * a.quantityKg / 1000;
        if (totalIndirect < a.precursorIndirectKg) {
            revert BelowPrecursorIndirectEmissions(totalIndirect, a.precursorIndirectKg);
        }
    }

    /// @notice The signing verifier or the authority withdraws a statement.
    /// Its open allocations can no longer be declared or consumed, the
    /// precursor allocations it consumed are reopened, and its shipment
    /// references become free. Withdrawing the latest statement reopens its
    /// period, and the periods of any withdrawn statements just before it, for
    /// corrected ones.
    function revokeStatement(bytes32 statementId, bytes32 reasonHash) external {
        Statement storage s = _statement(statementId);
        if (msg.sender != s.verifier && msg.sender != authority) revert NotStatementVerifier(statementId, msg.sender);
        if (s.revoked) revert StatementIsRevoked(statementId);
        s.revoked = true;

        if (latestStatement[s.installationId][s.cnCode] == statementId) {
            uint32 reopenFrom = s.periodStart;
            bytes32 prev = previousStatement[statementId];
            while (prev != bytes32(0) && _statements[prev].revoked) {
                reopenFrom = _statements[prev].periodStart;
                prev = previousStatement[prev];
            }
            coveredUntil[s.installationId][s.cnCode] = reopenFrom;
            latestStatement[s.installationId][s.cnCode] = prev;
        }

        bytes32[] storage inputs = _statementInputs[statementId];
        for (uint256 i = 0; i < inputs.length; i++) {
            Allocation storage al = _allocations[inputs[i]];
            if (al.status == AllocationStatus.Consumed && al.spentIn == statementId) {
                al.status = AllocationStatus.Open;
                al.spentIn = bytes32(0);
                emit Reopened(inputs[i], statementId);
            }
        }
        emit StatementRevoked(statementId, msg.sender, reasonHash);
    }

    // ─── Allocations ────────────────────────────────────────────────────────

    /// @notice The operator assigns part of a verified quantity to one shipment
    /// for one recipient. The sum of allocations can never pass the verified
    /// quantity, and a shipment reference can be used once.
    function allocate(bytes32 statementId, address recipient, uint64 quantityKg, bytes32 shipmentRef)
        external
        returns (bytes32 allocationId)
    {
        Statement storage s = _statement(statementId);
        if (msg.sender != installations[s.installationId].operator) revert NotOperator(s.installationId, msg.sender);
        if (s.revoked) revert StatementIsRevoked(statementId);
        if (quantityKg == 0) revert ZeroQuantity();
        if (recipient == address(0)) revert ZeroRecipient();
        uint64 available = s.quantityKg - s.allocatedKg;
        if (quantityKg > available) revert ExceedsVerifiedQuantity(statementId, available, quantityKg);
        bytes32 holder = shipmentAllocation[shipmentRef];
        if (holder != bytes32(0) && !_statements[_allocations[holder].statementId].revoked) {
            revert ShipmentAlreadyAllocated(shipmentRef);
        }

        s.allocatedKg += quantityKg;
        allocationId = keccak256(abi.encode(statementId, allocationIds.length));
        shipmentAllocation[shipmentRef] = allocationId;
        _allocations[allocationId] = Allocation({
            statementId: statementId,
            recipient: recipient,
            quantityKg: quantityKg,
            shipmentRef: shipmentRef,
            createdAt: uint40(block.timestamp),
            status: AllocationStatus.Open,
            spentIn: bytes32(0)
        });
        allocationIds.push(allocationId);
        emit Allocated(allocationId, statementId, recipient, quantityKg, shipmentRef);
    }

    /// @notice The recipient surrenders an allocation in exactly one CBAM declaration.
    function declare(bytes32 allocationId, bytes32 declarationRef) external {
        Allocation storage al = _allocation(allocationId);
        if (msg.sender != al.recipient) revert NotRecipient(allocationId, msg.sender);
        if (al.status != AllocationStatus.Open) revert AllocationNotOpen(allocationId, al.status);
        if (_statements[al.statementId].revoked) revert StatementIsRevoked(al.statementId);
        al.status = AllocationStatus.Declared;
        al.spentIn = declarationRef;
        emit Declared(allocationId, msg.sender, declarationRef);
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    function getStatement(bytes32 statementId) external view returns (Statement memory) {
        return _statement(statementId);
    }

    function getAllocation(bytes32 allocationId) external view returns (Allocation memory) {
        return _allocation(allocationId);
    }

    function getStatementInputs(bytes32 statementId) external view returns (bytes32[] memory) {
        _statement(statementId);
        return _statementInputs[statementId];
    }

    function availableKg(bytes32 statementId) external view returns (uint64) {
        Statement storage s = _statement(statementId);
        return s.revoked ? 0 : s.quantityKg - s.allocatedKg;
    }

    function statementCount() external view returns (uint256) {
        return statementIds.length;
    }

    function allocationCount() external view returns (uint256) {
        return allocationIds.length;
    }

    /// @notice Proves that one salted field belongs to a statement's evidence,
    /// without revealing the other fields.
    function verifyDisclosure(bytes32 statementId, bytes32 leaf, bytes32[] calldata proof)
        external
        view
        returns (bool)
    {
        return MerkleProof.verifyCalldata(proof, _statement(statementId).evidenceRoot, leaf);
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function _statement(bytes32 statementId) private view returns (Statement storage s) {
        s = _statements[statementId];
        if (s.verifier == address(0)) revert UnknownStatement(statementId);
    }

    function _allocation(bytes32 allocationId) private view returns (Allocation storage al) {
        al = _allocations[allocationId];
        if (al.status == AllocationStatus.None) revert UnknownAllocation(allocationId);
    }
}
