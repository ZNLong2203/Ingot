import { keccak256, toHex, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { actors } from "@/lib/chain/actors";
import { calculate } from "@/lib/cbam/calculate";
import { documents, supplier } from "@/lib/samples/marmara";
import { checkPassport, buildPassport } from "@/lib/passport";
import { referenceExtraction, deriveLines, deliveryNoteNumbers } from "./derive";
import { commit, disclosuresFor, findPrecursors, prepareAttestation, reportFields } from "./flow";
import type { DemoState } from "./store";
import { act, declarationRef, getWorld, shipmentRef, sign } from "./world";

/** The whole guided demo, end to end, on the sandbox chain. */
describe("demo flow", async () => {
  const state: DemoState = {
    step: 0,
    runs: Object.fromEntries(documents.map((d) => [d.id, { status: "done", source: "reference", extraction: referenceExtraction(d) }])),
    uploads: [],
    removed: {},
    shipments: [],
  };
  const chain = await getWorld();

  it("leaves the re-sent gas invoice out", () => {
    const { lines, duplicates } = deriveLines(state);
    expect(duplicates).toHaveLength(1);
    expect(lines.filter((l) => l.excluded)).toHaveLength(1);
    expect(lines.find((l) => l.excluded)?.documentId).toBe("gas-2026-08-copy");
  });

  let statementId: Hex;
  let allocationId: Hex;
  let passportArgs: Parameters<typeof buildPassport>[0];

  it("finds the pig iron on the ledger and anchors the mill's statement", async () => {
    const precursors = await findPrecursors(chain, deliveryNoteNumbers(state));
    expect(precursors).toHaveLength(1);
    expect(precursors[0].quantityTonnes).toBe(supplier.deliveredTonnes);

    const result = calculate(deriveLines(state).lines, precursors);
    expect(result.directKgPerTonne).toBe(354);
    const report = commit(reportFields(result), keccak256(toHex("mill seed")));
    const a = prepareAttestation({ chain, result, precursors, report });
    const signature = await sign(chain, "verifier", a);
    const tx = await act("operator", "submitStatement", [a, signature, precursors.map((p) => p.allocationId)]);
    expect(tx.status).toBe("success");
    expect(tx.events.map((e) => e.eventName)).toEqual(["Consumed", "StatementAttested"]);
    statementId = tx.result as Hex;

    const alloc = await act("operator", "allocate", [statementId, actors.importer.address, 6_000_000n, shipmentRef("26TR341000EX000101")]);
    expect(alloc.status).toBe("success");
    allocationId = alloc.result as Hex;
    passportArgs = {
      chain,
      attestation: a,
      signature,
      verifier: actors.verifier.address,
      statementId,
      installation: { name: "Marmara Demo Steel", country: "TR" },
      good: { cnCode: 72083900, description: "Hot-rolled coil" },
      period: { from: "2026-07-01", to: "2026-10-01" },
      allocation: { id: allocationId, tonnes: 6_000, recipient: actors.importer.address, shipmentRef: shipmentRef("26TR341000EX000101"), reference: "26TR341000EX000101" },
      disclosures: disclosuresFor(report),
      issuedAt: chain.now,
    };
  });

  it("issues a passport that checks out against the ledger", async () => {
    const { checks, status } = await checkPassport(buildPassport(passportArgs), chain);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
    expect(status).toBe("open");
  });

  it("catches a passport whose numbers were edited", async () => {
    const p = buildPassport(passportArgs);
    p.proof.eip712.message = { ...p.proof.eip712.message, directKgPerTonne: 120 };
    expect(() => JSON.stringify(p)).not.toThrow();
    const { checks } = await checkPassport(p, chain);
    expect(checks.find((c) => c.title.startsWith("Statement id"))?.ok).toBe(false);
  });

  it("catches a passport whose displayed figure was edited outside the signature", async () => {
    const p = buildPassport(passportArgs);
    p.credentialSubject.embeddedEmissions.directPerTonne = 0.05;
    const { checks } = await checkPassport(p, chain);
    expect(checks.find((c) => c.title === "Displayed figures are the signed ones")?.ok).toBe(false);
  });

  it("applies two clicks at once one after the other", async () => {
    const alloc = await act("operator", "allocate", [statementId, actors.importer2.address, 1_000_000n, shipmentRef("26TR341000EX000150")]);
    const id = alloc.result as Hex;
    const [a, b] = await Promise.all([
      act("importer2", "declare", [id, declarationRef("IT-1")]),
      act("importer2", "declare", [id, declarationRef("IT-2")]),
    ]);
    expect([a.status, b.status].sort()).toEqual(["reverted", "success"]);
  });

  it("refuses to sell the same tonnes twice, and to declare twice", async () => {
    const over = await act("operator", "allocate", [statementId, actors.importer2.address, 170_000_000n, shipmentRef("26TR341000EX000102")]);
    expect(over.status).toBe("reverted");
    expect(over.error?.name).toBe("ExceedsVerifiedQuantity");
    const d1 = await act("importer", "declare", [allocationId, declarationRef("DE-CBAM-2026-0001")]);
    expect(d1.status).toBe("success");
    const d2 = await act("importer", "declare", [allocationId, declarationRef("DE-CBAM-2026-0002")]);
    expect(d2.error?.name).toBe("AllocationNotOpen");
  });
});
