// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title CbamPassportRegistry
/// @notice Verified embedded-emissions statements for EU CBAM goods, and the
/// allocation of each verified tonne to at most one shipment and one customs
/// declaration.
///
/// Three double-counting doors are closed here:
///   1. Production: statements for the same installation and CN code may not
///      cover overlapping periods, so a tonne cannot be verified twice.
///   2. Supply: allocations from a statement may never exceed its verified
///      quantity, and a shipment reference can be used once.
///   3. Demand: an allocation can be surrendered in one CBAM declaration only.
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
        uint32 directKgPerTonne; // specific direct embedded emissions
        uint32 indirectKgPerTonne; // specific indirect embedded emissions
        uint32 carbonPriceCentsPerTonne; // carbon price effectively paid at origin, EUR cents per tonne of good
        bytes32 evidenceRoot; // Merkle root of the salted report fields
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
        bytes32 evidenceRoot;
        address verifier;
        uint40 attestedAt;
        bool revoked;
    }

    struct Allocation {
        bytes32 statementId;
        address importer;
        uint64 quantityKg;
        bytes32 shipmentRef; // hash of the customs movement reference (MRN)
        uint40 createdAt;
        bytes32 declarationRef; // set once, when surrendered in a CBAM declaration
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
        "Attestation(bytes32 installationId,uint32 cnCode,uint32 periodStart,uint32 periodEnd,uint64 quantityKg,uint32 directKgPerTonne,uint32 indirectKgPerTonne,uint32 carbonPriceCentsPerTonne,bytes32 evidenceRoot,uint40 deadline)"
    );

    // ─── State ──────────────────────────────────────────────────────────────

    address public authority;

    mapping(address => Verifier) public verifiers;
    mapping(bytes32 => Installation) public installations;
    mapping(bytes32 => Statement) private _statements;
    mapping(bytes32 => Allocation) private _allocations;

    /// @dev End of the latest live statement per installation and CN code.
    mapping(bytes32 => mapping(uint32 => uint32)) public coveredUntil;
    /// @dev The statement that set `coveredUntil`, so revoking it can reopen the period.
    mapping(bytes32 => mapping(uint32 => bytes32)) public latestStatement;
    mapping(bytes32 => bool) public shipmentUsed;

    bytes32[] public statementIds;
    bytes32[] public allocationIds;

    // ─── Events ─────────────────────────────────────────────────────────────

    event AuthorityTransferred(address indexed from, address indexed to);
    event VerifierAccredited(address indexed verifier, string name, uint40 accreditedUntil);
    event VerifierSuspended(address indexed verifier);
    event InstallationRegistered(bytes32 indexed installationId, address indexed operator, bytes2 country, address indexed registeredBy);
    event StatementAttested(
        bytes32 indexed statementId,
        bytes32 indexed installationId,
        address indexed verifier,
        uint32 cnCode,
        uint32 periodStart,
        uint32 periodEnd,
        uint64 quantityKg,
        uint32 directKgPerTonne,
        uint32 indirectKgPerTonne
    );
    event StatementRevoked(bytes32 indexed statementId, address indexed by, bytes32 reasonHash);
    event Allocated(
        bytes32 indexed allocationId, bytes32 indexed statementId, address indexed importer, uint64 quantityKg, bytes32 shipmentRef
    );
    event Declared(bytes32 indexed allocationId, address indexed importer, bytes32 declarationRef);

    // ─── Errors ─────────────────────────────────────────────────────────────

    error NotAuthority();
    error NotAccreditedVerifier(address account);
    error NotOperator(bytes32 installationId, address account);
    error NotImporter(bytes32 allocationId, address account);
    error NotStatementVerifier(bytes32 statementId, address account);
    error InstallationExists(bytes32 installationId);
    error UnknownInstallation(bytes32 installationId);
    error UnknownStatement(bytes32 statementId);
    error UnknownAllocation(bytes32 allocationId);
    error SignatureExpired(uint40 deadline);
    error InvalidPeriod(uint32 periodStart, uint32 periodEnd);
    error PeriodOverlaps(uint32 periodStart, uint32 coveredUntil);
    error ZeroQuantity();
    error ZeroImporter();
    error StatementExists(bytes32 statementId);
    error StatementIsRevoked(bytes32 statementId);
    error ExceedsVerifiedQuantity(bytes32 statementId, uint64 availableKg, uint64 requestedKg);
    error ShipmentAlreadyAllocated(bytes32 shipmentRef);
    error AlreadyDeclared(bytes32 allocationId, bytes32 declarationRef);

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
        emit AuthorityTransferred(authority, to);
        authority = to;
    }

    /// @notice The accreditation body admits a verifier until a given time.
    function accreditVerifier(address verifier, string calldata name, uint40 accreditedUntil) external onlyAuthority {
        verifiers[verifier] = Verifier({name: name, accreditedUntil: accreditedUntil, suspended: false});
        emit VerifierAccredited(verifier, name, accreditedUntil);
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
    function registerInstallation(bytes32 installationId, address operator, bytes2 country, bytes32 metadataHash) external {
        if (!isAccredited(msg.sender)) revert NotAccreditedVerifier(msg.sender);
        if (installations[installationId].operator != address(0)) revert InstallationExists(installationId);
        installations[installationId] =
            Installation({operator: operator, country: country, metadataHash: metadataHash, registeredBy: msg.sender});
        emit InstallationRegistered(installationId, operator, country, msg.sender);
    }

    // ─── Statements ─────────────────────────────────────────────────────────

    function hashAttestation(Attestation calldata a) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ATTESTATION_TYPEHASH,
                    a.installationId,
                    a.cnCode,
                    a.periodStart,
                    a.periodEnd,
                    a.quantityKg,
                    a.directKgPerTonne,
                    a.indirectKgPerTonne,
                    a.carbonPriceCentsPerTonne,
                    a.evidenceRoot,
                    a.deadline
                )
            )
        );
    }

    /// @notice The operator records a statement that an accredited verifier
    /// signed off chain (EIP-712). The signature travels with the passport, so
    /// anyone can check it without trusting the operator.
    function submitStatement(Attestation calldata a, bytes calldata signature) external returns (bytes32 statementId) {
        Installation storage inst = installations[a.installationId];
        if (inst.operator == address(0)) revert UnknownInstallation(a.installationId);
        if (msg.sender != inst.operator) revert NotOperator(a.installationId, msg.sender);
        if (block.timestamp > a.deadline) revert SignatureExpired(a.deadline);
        if (a.periodEnd <= a.periodStart) revert InvalidPeriod(a.periodStart, a.periodEnd);
        if (a.quantityKg == 0) revert ZeroQuantity();

        uint32 covered = coveredUntil[a.installationId][a.cnCode];
        if (a.periodStart < covered) revert PeriodOverlaps(a.periodStart, covered);

        statementId = hashAttestation(a);
        // A revoked statement reopens its period, but the same signed
        // attestation must not come back with its allocations reset.
        if (_statements[statementId].verifier != address(0)) revert StatementExists(statementId);
        address signer = ECDSA.recover(statementId, signature);
        if (!isAccredited(signer)) revert NotAccreditedVerifier(signer);

        _statements[statementId] = Statement({
            installationId: a.installationId,
            cnCode: a.cnCode,
            periodStart: a.periodStart,
            periodEnd: a.periodEnd,
            quantityKg: a.quantityKg,
            allocatedKg: 0,
            directKgPerTonne: a.directKgPerTonne,
            indirectKgPerTonne: a.indirectKgPerTonne,
            carbonPriceCentsPerTonne: a.carbonPriceCentsPerTonne,
            evidenceRoot: a.evidenceRoot,
            verifier: signer,
            attestedAt: uint40(block.timestamp),
            revoked: false
        });
        coveredUntil[a.installationId][a.cnCode] = a.periodEnd;
        latestStatement[a.installationId][a.cnCode] = statementId;
        statementIds.push(statementId);

        emit StatementAttested(
            statementId,
            a.installationId,
            signer,
            a.cnCode,
            a.periodStart,
            a.periodEnd,
            a.quantityKg,
            a.directKgPerTonne,
            a.indirectKgPerTonne
        );
    }

    /// @notice The signing verifier or the authority withdraws a statement.
    /// Every allocation from it stops being valid. Revoking the latest
    /// statement reopens its period for a corrected one.
    function revokeStatement(bytes32 statementId, bytes32 reasonHash) external {
        Statement storage s = _statement(statementId);
        if (msg.sender != s.verifier && msg.sender != authority) revert NotStatementVerifier(statementId, msg.sender);
        if (s.revoked) revert StatementIsRevoked(statementId);
        s.revoked = true;
        if (latestStatement[s.installationId][s.cnCode] == statementId) {
            coveredUntil[s.installationId][s.cnCode] = s.periodStart;
            delete latestStatement[s.installationId][s.cnCode];
        }
        emit StatementRevoked(statementId, msg.sender, reasonHash);
    }

    // ─── Allocations ────────────────────────────────────────────────────────

    /// @notice The operator assigns part of a verified quantity to one shipment
    /// for one importer. The sum of allocations can never pass the verified
    /// quantity, and a shipment reference can be used once.
    function allocate(bytes32 statementId, address importer, uint64 quantityKg, bytes32 shipmentRef)
        external
        returns (bytes32 allocationId)
    {
        Statement storage s = _statement(statementId);
        if (msg.sender != installations[s.installationId].operator) revert NotOperator(s.installationId, msg.sender);
        if (s.revoked) revert StatementIsRevoked(statementId);
        if (quantityKg == 0) revert ZeroQuantity();
        if (importer == address(0)) revert ZeroImporter();
        uint64 available = s.quantityKg - s.allocatedKg;
        if (quantityKg > available) revert ExceedsVerifiedQuantity(statementId, available, quantityKg);
        if (shipmentUsed[shipmentRef]) revert ShipmentAlreadyAllocated(shipmentRef);

        s.allocatedKg += quantityKg;
        shipmentUsed[shipmentRef] = true;
        allocationId = keccak256(abi.encode(statementId, allocationIds.length));
        _allocations[allocationId] = Allocation({
            statementId: statementId,
            importer: importer,
            quantityKg: quantityKg,
            shipmentRef: shipmentRef,
            createdAt: uint40(block.timestamp),
            declarationRef: bytes32(0)
        });
        allocationIds.push(allocationId);
        emit Allocated(allocationId, statementId, importer, quantityKg, shipmentRef);
    }

    /// @notice The importer surrenders an allocation in exactly one CBAM declaration.
    function declare(bytes32 allocationId, bytes32 declarationRef) external {
        Allocation storage al = _allocation(allocationId);
        if (msg.sender != al.importer) revert NotImporter(allocationId, msg.sender);
        if (al.declarationRef != bytes32(0)) revert AlreadyDeclared(allocationId, al.declarationRef);
        if (_statements[al.statementId].revoked) revert StatementIsRevoked(al.statementId);
        al.declarationRef = declarationRef;
        emit Declared(allocationId, msg.sender, declarationRef);
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    function getStatement(bytes32 statementId) external view returns (Statement memory) {
        return _statement(statementId);
    }

    function getAllocation(bytes32 allocationId) external view returns (Allocation memory) {
        return _allocation(allocationId);
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
    function verifyDisclosure(bytes32 statementId, bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
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
        if (al.importer == address(0)) revert UnknownAllocation(allocationId);
    }
}
