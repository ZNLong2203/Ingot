import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { keccak256, toHex, zeroHash, type Hex } from "viem";

const DAY = 86_400;
const Q1_START = 1_767_225_600; // 2026-01-01T00:00:00Z
const Q1_END = 1_775_001_600; // 2026-04-01T00:00:00Z
const Q2_END = 1_782_864_000; // 2026-07-01T00:00:00Z
const HOT_ROLLED = 72083900;
const INSTALLATION = keccak256(toHex("TR-ISTANBUL-EAF-01"));

describe("CbamPassportRegistry", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [authority, verifier, operator, importer, importer2, stranger] = await viem.getWalletClients();

  async function now() {
    return Number((await publicClient.getBlock()).timestamp);
  }

  async function deploy() {
    const registry = await viem.deployContract("CbamPassportRegistry", [authority.account.address]);
    const until = (await now()) + 365 * DAY;
    await registry.write.accreditVerifier([verifier.account.address, "Demo Verification GmbH", until]);
    await registry.write.registerInstallation(
      [INSTALLATION, operator.account.address, "0x5452", keccak256(toHex("installation record"))],
      { account: verifier.account },
    );
    return registry;
  }

  async function attestation(overrides: Partial<Record<string, bigint | number | Hex>> = {}) {
    return {
      installationId: INSTALLATION,
      cnCode: HOT_ROLLED,
      periodStart: Q1_START,
      periodEnd: Q1_END,
      quantityKg: 10_000_000n, // 10,000 t
      directKgPerTonne: 420,
      indirectKgPerTonne: 310,
      carbonPriceCentsPerTonne: 0,
      evidenceRoot: keccak256(toHex("evidence")),
      deadline: (await now()) + DAY,
      ...overrides,
    } as const;
  }

  async function sign(registry: Awaited<ReturnType<typeof deploy>>, a: Awaited<ReturnType<typeof attestation>>, signer = verifier) {
    return signer.signTypedData({
      domain: {
        name: "CbamPassportRegistry",
        version: "1",
        chainId: await publicClient.getChainId(),
        verifyingContract: registry.address,
      },
      types: {
        Attestation: [
          { name: "installationId", type: "bytes32" },
          { name: "cnCode", type: "uint32" },
          { name: "periodStart", type: "uint32" },
          { name: "periodEnd", type: "uint32" },
          { name: "quantityKg", type: "uint64" },
          { name: "directKgPerTonne", type: "uint32" },
          { name: "indirectKgPerTonne", type: "uint32" },
          { name: "carbonPriceCentsPerTonne", type: "uint32" },
          { name: "evidenceRoot", type: "bytes32" },
          { name: "deadline", type: "uint40" },
        ],
      },
      primaryType: "Attestation",
      message: a,
    });
  }

  async function withStatement() {
    const registry = await deploy();
    const a = await attestation();
    const signature = await sign(registry, a);
    await registry.write.submitStatement([a, signature], { account: operator.account });
    const statementId = await registry.read.statementIds([0n]);
    return { registry, statementId };
  }

  it("records a statement signed by an accredited verifier", async function () {
    const { registry, statementId } = await withStatement();
    const s = await registry.read.getStatement([statementId]);
    assert.equal(s.verifier.toLowerCase(), verifier.account.address.toLowerCase());
    assert.equal(s.quantityKg, 10_000_000n);
    assert.equal(await registry.read.availableKg([statementId]), 10_000_000n);
    assert.equal(await registry.read.coveredUntil([INSTALLATION, HOT_ROLLED]), Q1_END);
  });

  it("refuses a signature from someone who is not accredited", async function () {
    const registry = await deploy();
    const a = await attestation();
    const signature = await sign(registry, a, stranger);
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.submitStatement([a, signature], { account: operator.account }),
      registry,
      "NotAccreditedVerifier",
      [stranger.account.address],
    );
  });

  it("refuses a statement whose fields were changed after signing", async function () {
    const registry = await deploy();
    const a = await attestation();
    const signature = await sign(registry, a);
    const tampered = { ...a, directKgPerTonne: 120 };
    await viem.assertions.revertWithCustomError(
      registry.write.submitStatement([tampered, signature], { account: operator.account }),
      registry,
      "NotAccreditedVerifier",
    );
  });

  it("refuses a second statement for an overlapping period", async function () {
    const { registry } = await withStatement();
    const overlap = await attestation({ periodStart: Q1_START + 30 * DAY, periodEnd: Q2_END });
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.submitStatement([overlap, await sign(registry, overlap)], { account: operator.account }),
      registry,
      "PeriodOverlaps",
      [Q1_START + 30 * DAY, Q1_END],
    );
  });

  it("accepts the next, adjacent period", async function () {
    const { registry } = await withStatement();
    const q2 = await attestation({ periodStart: Q1_END, periodEnd: Q2_END });
    await registry.write.submitStatement([q2, await sign(registry, q2)], { account: operator.account });
    assert.equal(await registry.read.statementCount(), 2n);
  });

  it("only lets the installation's operator submit or allocate", async function () {
    const registry = await deploy();
    const a = await attestation();
    await viem.assertions.revertWithCustomError(
      registry.write.submitStatement([a, await sign(registry, a)], { account: stranger.account }),
      registry,
      "NotOperator",
    );
  });

  it("allocates up to the verified quantity and no further", async function () {
    const { registry, statementId } = await withStatement();
    const ship1 = keccak256(toHex("26TR0001"));
    const ship2 = keccak256(toHex("26TR0002"));
    await registry.write.allocate([statementId, importer.account.address, 7_500_000n, ship1], { account: operator.account });
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.allocate([statementId, importer2.account.address, 3_000_000n, ship2], { account: operator.account }),
      registry,
      "ExceedsVerifiedQuantity",
      [statementId, 2_500_000n, 3_000_000n],
    );
    await registry.write.allocate([statementId, importer2.account.address, 2_500_000n, ship2], { account: operator.account });
    assert.equal(await registry.read.availableKg([statementId]), 0n);
  });

  it("uses a shipment reference once", async function () {
    const { registry, statementId } = await withStatement();
    const ship = keccak256(toHex("26TR0001"));
    await registry.write.allocate([statementId, importer.account.address, 1_000_000n, ship], { account: operator.account });
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.allocate([statementId, importer2.account.address, 1_000_000n, ship], { account: operator.account }),
      registry,
      "ShipmentAlreadyAllocated",
      [ship],
    );
  });

  it("lets the importer surrender an allocation in one declaration only", async function () {
    const { registry, statementId } = await withStatement();
    await registry.write.allocate([statementId, importer.account.address, 1_000_000n, keccak256(toHex("s1"))], {
      account: operator.account,
    });
    const allocationId = await registry.read.allocationIds([0n]);
    const decl = keccak256(toHex("DE-2026-CBAM-001"));
    await viem.assertions.revertWithCustomError(
      registry.write.declare([allocationId, decl], { account: stranger.account }),
      registry,
      "NotImporter",
    );
    await registry.write.declare([allocationId, decl], { account: importer.account });
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.declare([allocationId, keccak256(toHex("DE-2026-CBAM-002"))], { account: importer.account }),
      registry,
      "AlreadyDeclared",
      [allocationId, decl],
    );
  });

  it("stops allocations and declarations after revocation, and reopens the period", async function () {
    const { registry, statementId } = await withStatement();
    await registry.write.allocate([statementId, importer.account.address, 1_000_000n, keccak256(toHex("s1"))], {
      account: operator.account,
    });
    const allocationId = await registry.read.allocationIds([0n]);
    await registry.write.revokeStatement([statementId, keccak256(toHex("meter calibration expired"))], {
      account: verifier.account,
    });
    assert.equal(await registry.read.availableKg([statementId]), 0n);
    await viem.assertions.revertWithCustomError(
      registry.write.allocate([statementId, importer.account.address, 1n, keccak256(toHex("s2"))], { account: operator.account }),
      registry,
      "StatementIsRevoked",
    );
    await viem.assertions.revertWithCustomError(
      registry.write.declare([allocationId, keccak256(toHex("d"))], { account: importer.account }),
      registry,
      "StatementIsRevoked",
    );
    assert.equal(await registry.read.coveredUntil([INSTALLATION, HOT_ROLLED]), Q1_START);
  });

  it("does not let a revoked attestation return with its allocations reset", async function () {
    const registry = await deploy();
    const a = await attestation();
    const signature = await sign(registry, a);
    await registry.write.submitStatement([a, signature], { account: operator.account });
    const statementId = await registry.read.statementIds([0n]);
    await registry.write.revokeStatement([statementId, zeroHash], { account: verifier.account });
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.submitStatement([a, signature], { account: operator.account }),
      registry,
      "StatementExists",
      [statementId],
    );
  });

  it("refuses signatures from a suspended verifier", async function () {
    const registry = await deploy();
    await registry.write.suspendVerifier([verifier.account.address]);
    const a = await attestation();
    await viem.assertions.revertWithCustomError(
      registry.write.submitStatement([a, await sign(registry, a)], { account: operator.account }),
      registry,
      "NotAccreditedVerifier",
    );
  });

  it("proves one disclosed field against the evidence root", async function () {
    const registry = await deploy();
    // Two salted leaves, hashed the way lib/crypto/disclosure.ts does.
    const leafA = keccak256(keccak256(toHex("salt-a|directKgPerTonne|420")));
    const leafB = keccak256(keccak256(toHex("salt-b|electricityMWh|58000")));
    const [lo, hi] = [leafA, leafB].sort();
    const root = keccak256(`0x${lo.slice(2)}${hi.slice(2)}`);
    const a = await attestation({ evidenceRoot: root });
    await registry.write.submitStatement([a, await sign(registry, a)], { account: operator.account });
    const statementId = await registry.read.statementIds([0n]);
    assert.equal(await registry.read.verifyDisclosure([statementId, leafA, [leafB]]), true);
    assert.equal(await registry.read.verifyDisclosure([statementId, leafA, [leafA]]), false);
  });
});
