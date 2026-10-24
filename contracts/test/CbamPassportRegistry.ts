import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { encodeAbiParameters, keccak256, toHex, zeroHash, type Hex } from "viem";
import { commit, disclose } from "../../lib/crypto/disclosure.ts";

const DAY = 86_400;
const Q4_2025_START = 1_759_276_800; // 2025-10-01T00:00:00Z
const Q1_START = 1_767_225_600; // 2026-01-01T00:00:00Z
const Q1_END = 1_775_001_600; // 2026-04-01T00:00:00Z
const Q2_END = 1_782_864_000; // 2026-07-01T00:00:00Z
const HOT_ROLLED = 72083900;
const PIG_IRON = 72011011;
const MILL = keccak256(toHex("TR-KOCAELI-EAF-01"));
const SMELTER = keccak256(toHex("BR-MG-BF-07"));

const inputsHash = (ids: readonly Hex[]) => keccak256(encodeAbiParameters([{ type: "bytes32[]" }], [ids]));

describe("CbamPassportRegistry", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [authority, verifier, operator, importer, importer2, stranger, supplier] = await viem.getWalletClients();

  async function now() {
    return Number((await publicClient.getBlock()).timestamp);
  }

  async function deploy() {
    const registry = await viem.deployContract("CbamPassportRegistry", [authority.account.address]);
    const until = (await now()) + 365 * DAY;
    await registry.write.accreditVerifier([verifier.account.address, "Demo Verification Ltd.", until]);
    await registry.write.registerInstallation(
      [MILL, operator.account.address, "0x5452", keccak256(toHex("mill record"))],
      { account: verifier.account },
    );
    await registry.write.registerInstallation(
      [SMELTER, supplier.account.address, "0x4252", keccak256(toHex("smelter record"))],
      { account: verifier.account },
    );
    return registry;
  }
  type Registry = Awaited<ReturnType<typeof deploy>>;

  async function attestation(overrides: Record<string, unknown> = {}) {
    return {
      installationId: MILL,
      cnCode: HOT_ROLLED,
      periodStart: Q1_START,
      periodEnd: Q1_END,
      quantityKg: 10_000_000n, // 10,000 t
      directKgPerTonne: 420,
      indirectKgPerTonne: 310,
      carbonPriceCentsPerTonne: 0,
      evidenceRoot: keccak256(toHex("evidence")),
      inputsHash: inputsHash([]),
      precursorDirectKg: 0n,
      precursorIndirectKg: 0n,
      deadline: (await now()) + DAY,
      ...overrides,
    } as {
      installationId: Hex;
      cnCode: number;
      periodStart: number;
      periodEnd: number;
      quantityKg: bigint;
      directKgPerTonne: number;
      indirectKgPerTonne: number;
      carbonPriceCentsPerTonne: number;
      evidenceRoot: Hex;
      inputsHash: Hex;
      precursorDirectKg: bigint;
      precursorIndirectKg: bigint;
      deadline: number;
    };
  }
  type Attestation = Awaited<ReturnType<typeof attestation>>;

  async function sign(registry: Registry, a: Attestation, signer = verifier) {
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
          { name: "inputsHash", type: "bytes32" },
          { name: "precursorDirectKg", type: "uint64" },
          { name: "precursorIndirectKg", type: "uint64" },
          { name: "deadline", type: "uint40" },
        ],
      },
      primaryType: "Attestation",
      message: a,
    });
  }

  async function submit(registry: Registry, a: Attestation, inputs: Hex[] = [], account = operator.account) {
    await registry.write.submitStatement([a, await sign(registry, a), inputs], { account });
    return registry.read.statementIds([(await registry.read.statementCount()) - 1n]);
  }

  async function withStatement() {
    const registry = await deploy();
    const statementId = await submit(registry, await attestation());
    return { registry, statementId };
  }

  /** A smelter's verified pig iron, with 18,000 t delivered to the mill. */
  async function withPrecursor() {
    const registry = await deploy();
    const pig = await attestation({
      installationId: SMELTER,
      cnCode: PIG_IRON,
      periodStart: Q4_2025_START,
      periodEnd: Q1_START,
      quantityKg: 60_000_000n,
      directKgPerTonne: 1_910,
      indirectKgPerTonne: 95,
    });
    const pigId = await submit(registry, pig, [], supplier.account);
    await registry.write.allocate([pigId, operator.account.address, 18_000_000n, keccak256(toHex("DN-2026-0042"))], {
      account: supplier.account,
    });
    const inputId = await registry.read.allocationIds([0n]);
    return { registry, pigId, inputId };
  }

  it("records a statement signed by an accredited verifier", async function () {
    const { registry, statementId } = await withStatement();
    const s = await registry.read.getStatement([statementId]);
    assert.equal(s.verifier.toLowerCase(), verifier.account.address.toLowerCase());
    assert.equal(s.quantityKg, 10_000_000n);
    assert.equal(await registry.read.availableKg([statementId]), 10_000_000n);
    assert.equal(await registry.read.coveredUntil([MILL, HOT_ROLLED]), Q1_END);
  });

  it("refuses a signature from someone who is not accredited", async function () {
    const registry = await deploy();
    const a = await attestation();
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.submitStatement([a, await sign(registry, a, stranger), []], { account: operator.account }),
      registry,
      "NotAccreditedVerifier",
      [stranger.account.address],
    );
  });

  it("refuses a statement whose fields were changed after signing", async function () {
    const registry = await deploy();
    const a = await attestation();
    const signature = await sign(registry, a);
    await viem.assertions.revertWithCustomError(
      registry.write.submitStatement([{ ...a, directKgPerTonne: 120 }, signature, []], { account: operator.account }),
      registry,
      "NotAccreditedVerifier",
    );
  });

  it("refuses a second statement for an overlapping period", async function () {
    const { registry } = await withStatement();
    const overlap = await attestation({ periodStart: Q1_START + 30 * DAY, periodEnd: Q2_END });
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.submitStatement([overlap, await sign(registry, overlap), []], { account: operator.account }),
      registry,
      "PeriodOverlaps",
      [Q1_START + 30 * DAY, Q1_END],
    );
  });

  it("accepts the next, adjacent period", async function () {
    const { registry } = await withStatement();
    await submit(registry, await attestation({ periodStart: Q1_END, periodEnd: Q2_END }));
    assert.equal(await registry.read.statementCount(), 2n);
  });

  it("only lets the installation's operator submit or allocate", async function () {
    const { registry, statementId } = await withStatement();
    const a = await attestation({ periodStart: Q1_END, periodEnd: Q2_END });
    await viem.assertions.revertWithCustomError(
      registry.write.submitStatement([a, await sign(registry, a), []], { account: stranger.account }),
      registry,
      "NotOperator",
    );
    await viem.assertions.revertWithCustomError(
      registry.write.allocate([statementId, importer.account.address, 1n, zeroHash], { account: stranger.account }),
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

  it("lets the recipient surrender an allocation in one declaration only", async function () {
    const { registry, statementId } = await withStatement();
    await registry.write.allocate([statementId, importer.account.address, 1_000_000n, keccak256(toHex("s1"))], {
      account: operator.account,
    });
    const allocationId = await registry.read.allocationIds([0n]);
    const decl = keccak256(toHex("DE-2026-CBAM-001"));
    await viem.assertions.revertWithCustomError(
      registry.write.declare([allocationId, decl], { account: stranger.account }),
      registry,
      "NotRecipient",
    );
    await registry.write.declare([allocationId, decl], { account: importer.account });
    const al = await registry.read.getAllocation([allocationId]);
    assert.equal(al.status, 2); // Declared
    assert.equal(al.spentIn, decl);
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.declare([allocationId, keccak256(toHex("DE-2026-CBAM-002"))], { account: importer.account }),
      registry,
      "AllocationNotOpen",
      [allocationId, 2],
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
    assert.equal(await registry.read.coveredUntil([MILL, HOT_ROLLED]), Q1_START);
  });

  it("does not let a revoked attestation return with its allocations reset", async function () {
    const registry = await deploy();
    const a = await attestation();
    const signature = await sign(registry, a);
    await registry.write.submitStatement([a, signature, []], { account: operator.account });
    const statementId = await registry.read.statementIds([0n]);
    await registry.write.revokeStatement([statementId, zeroHash], { account: verifier.account });
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.submitStatement([a, signature, []], { account: operator.account }),
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
      registry.write.submitStatement([a, await sign(registry, a), []], { account: operator.account }),
      registry,
      "NotAccreditedVerifier",
    );
  });

  describe("precursors", function () {
    // 18,000 t x 1,910 kg/t = 34,380,000 kg direct; x 95 kg/t = 1,710,000 kg indirect.
    const PRE_DIRECT = 34_380_000n;
    const PRE_INDIRECT = 1_710_000n;

    async function millAttestation(inputId: Hex, overrides: Record<string, unknown> = {}) {
      return attestation({
        quantityKg: 171_000_000n, // 171,000 t of hot-rolled coil
        directKgPerTonne: 318, // 54.4 kt total, of which 34.4 kt came with the pig iron
        indirectKgPerTonne: 262,
        inputsHash: inputsHash([inputId]),
        precursorDirectKg: PRE_DIRECT,
        precursorIndirectKg: PRE_INDIRECT,
        ...overrides,
      });
    }

    it("consumes a verified precursor and carries its emissions downstream", async function () {
      const { registry, inputId } = await withPrecursor();
      const millId = await submit(registry, await millAttestation(inputId), [inputId]);
      const al = await registry.read.getAllocation([inputId]);
      assert.equal(al.status, 3); // Consumed
      assert.equal(al.spentIn, millId);
      assert.deepEqual(await registry.read.getStatementInputs([millId]), [inputId]);
      const s = await registry.read.getStatement([millId]);
      assert.equal(s.precursorDirectKg, PRE_DIRECT);
    });

    it("refuses precursor emissions that differ from the upstream statements", async function () {
      const { registry, inputId } = await withPrecursor();
      const a = await millAttestation(inputId, { precursorDirectKg: 20_000_000n });
      await viem.assertions.revertWithCustomErrorWithArgs(
        registry.write.submitStatement([a, await sign(registry, a), [inputId]], { account: operator.account }),
        registry,
        "PrecursorEmissionsMismatch",
        [20_000_000n, PRE_INDIRECT, PRE_DIRECT, PRE_INDIRECT],
      );
    });

    it("refuses a product that claims less carbon than the precursors it consumed", async function () {
      const { registry, inputId } = await withPrecursor();
      // 171,000 t x 150 kg/t = 25,650 t: below the 34,380 t that came with the pig iron.
      const a = await millAttestation(inputId, { directKgPerTonne: 150 });
      await viem.assertions.revertWithCustomErrorWithArgs(
        registry.write.submitStatement([a, await sign(registry, a), [inputId]], { account: operator.account }),
        registry,
        "BelowPrecursorEmissions",
        [25_650_000n, PRE_DIRECT],
      );
    });

    it("refuses inputs swapped after the verifier signed", async function () {
      const { registry, inputId } = await withPrecursor();
      const a = await millAttestation(inputId);
      await viem.assertions.revertWithCustomError(
        registry.write.submitStatement([a, await sign(registry, a), []], { account: operator.account }),
        registry,
        "InputsMismatch",
      );
    });

    it("consumes a precursor once", async function () {
      const { registry, inputId } = await withPrecursor();
      await submit(registry, await millAttestation(inputId), [inputId]);
      const again = await millAttestation(inputId, { periodStart: Q1_END, periodEnd: Q2_END });
      await viem.assertions.revertWithCustomErrorWithArgs(
        registry.write.submitStatement([again, await sign(registry, again), [inputId]], { account: operator.account }),
        registry,
        "AllocationNotOpen",
        [inputId, 3],
      );
    });

    it("refuses someone else's precursor", async function () {
      const { registry, pigId } = await withPrecursor();
      await registry.write.allocate([pigId, importer.account.address, 1_000_000n, keccak256(toHex("DN-2026-0043"))], {
        account: supplier.account,
      });
      const foreign = await registry.read.allocationIds([1n]);
      const a = await millAttestation(foreign, { precursorDirectKg: 1_910_000n, precursorIndirectKg: 95_000n });
      await viem.assertions.revertWithCustomErrorWithArgs(
        registry.write.submitStatement([a, await sign(registry, a), [foreign]], { account: operator.account }),
        registry,
        "NotRecipient",
        [foreign, operator.account.address],
      );
    });

    it("refuses a precursor whose statement was revoked", async function () {
      const { registry, pigId, inputId } = await withPrecursor();
      await registry.write.revokeStatement([pigId, keccak256(toHex("fuel invoices missing"))], { account: verifier.account });
      const a = await millAttestation(inputId);
      await viem.assertions.revertWithCustomErrorWithArgs(
        registry.write.submitStatement([a, await sign(registry, a), [inputId]], { account: operator.account }),
        registry,
        "StatementIsRevoked",
        [pigId],
      );
    });
  });

  it("never allocates more than it verified, across a long random sequence", async function () {
    const { registry, statementId } = await withStatement();
    let seed = 42;
    const rand = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
    let allocated = 0n;
    for (let i = 0; i < 60; i++) {
      const q = BigInt(Math.floor(rand() * 900_000) + 1);
      const ship = keccak256(toHex(`ship-${i}`));
      const recipient = rand() < 0.5 ? importer.account.address : importer2.account.address;
      if (allocated + q <= 10_000_000n) {
        await registry.write.allocate([statementId, recipient, q, ship], { account: operator.account });
        allocated += q;
      } else {
        await viem.assertions.revertWithCustomError(
          registry.write.allocate([statementId, recipient, q, ship], { account: operator.account }),
          registry,
          "ExceedsVerifiedQuantity",
        );
      }
      assert.equal(await registry.read.availableKg([statementId]), 10_000_000n - allocated);
    }
  });

  it("proves one disclosed field against the evidence root", async function () {
    const registry = await deploy();
    // The same commitment the web app builds (lib/crypto/disclosure.ts).
    const report = commit(
      { directKgPerTonne: 420, electricityMWh: 58_000, naturalGasNm3: 3_900_000, scrapTonnes: 11_200 },
      keccak256(toHex("operator secret")),
    );
    const statementId = await submit(registry, await attestation({ evidenceRoot: report.root }));
    const d = disclose(report, "electricityMWh");
    const leaf = report.leaves.find((l) => l.key === "electricityMWh")!.leaf;
    assert.equal(await registry.read.verifyDisclosure([statementId, leaf, d.proof]), true);
    const forged = report.leaves.find((l) => l.key === "directKgPerTonne")!.leaf;
    assert.equal(await registry.read.verifyDisclosure([statementId, forged, d.proof]), false);
  });
});
