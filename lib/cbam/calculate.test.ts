import { describe, expect, it } from "vitest";
import { documents, supplier } from "@/lib/samples/marmara";
import { calculate, gasNetTj, type ActivityLine, type PrecursorInput } from "./calculate";
import { certificatesDue, compareWithDefault, sefaActualCoil, sefaDefaultCoil, turkeyDefaultSee } from "./cost";

function referenceLines(includeCopy = false): ActivityLine[] {
  return documents
    .filter((d) => includeCopy || !d.id.endsWith("-copy"))
    .flatMap((d) =>
      d.lines
        .filter(() => d.kind !== "delivery_note")
        .map((l, i) => ({ ...l, id: `${d.id}#${i}`, documentId: d.id, documentNumber: d.documentNumber })),
    );
}

const pigIron: PrecursorInput = {
  allocationId: "0xabc",
  label: "Pig iron, Demo Gusa (verified)",
  quantityTonnes: supplier.deliveredTonnes,
  directKgPerTonne: supplier.directKgPerTonne,
  indirectKgPerTonne: supplier.indirectKgPerTonne,
};

describe("embedded emissions of the demo mill", () => {
  const r = calculate(referenceLines(), [pigIron]);

  it("converts invoiced Sm3 and gross calorific value to net energy", () => {
    const tj = gasNetTj({ id: "g", stream: "natural_gas", month: "2026-07", quantity: 1_000_000, unit: "Sm3", documentId: "d", gcvKcalPerSm3: 9_155 });
    // 1e6 Sm3 × 9,155 kcal × 4.1868 kJ/kcal = 38.33 TJ gross; × 0.9 = 34.50 TJ net.
    expect(tj).toBeCloseTo(34.497, 2);
  });

  it("balances carbon in the furnace and burns gas in the reheating furnace", () => {
    const row = (s: string) => r.trace.find((t) => t.stream === s)!;
    expect(row("scrap").directT).toBeCloseTo(7_128, 1);
    expect(row("pig_iron").directT).toBeCloseTo(2_700, 1);
    expect(row("electrodes").directT).toBeCloseTo(866.1, 1);
    expect(row("charge_carbon").directT).toBeCloseTo(9_864.8, 1);
    expect(row("crude_steel").directT).toBeCloseTo(-7_208, 1);
    expect(row("carbonates").directT).toBeCloseTo(574.8, 1);
    expect(row("natural_gas").directT).toBeCloseTo(12_240.7, 0);
    expect(row("precursor").directT).toBe(34_380);
    // 77 kg CO2 per tonne of liquid steel: inside the EU BREF's 72-180 for EAF stacks.
    expect((r.eaf.ownDirectT / r.crudeSteelT) * 1000).toBeCloseTo(77.3, 1);
  });

  it("produces specific embedded emissions for the rolled good", () => {
    expect(r.crudeSteelT).toBe(180_200);
    expect(r.hotRolledT).toBe(171_200);
    expect(r.seeDirect).toBeCloseTo(0.35366, 4);
    expect(r.directKgPerTonne).toBe(354);
    expect(r.missing).toEqual([]);
  });

  it("would overstate gas if the re-sent invoice were counted", () => {
    const withCopy = calculate(referenceLines(true), [pigIron]);
    expect(withCopy.seeDirect).toBeGreaterThan(r.seeDirect);
  });

  it("flags pig iron that no verified allocation covers", () => {
    expect(calculate(referenceLines(), []).missing.join()).toMatch(/pig iron charged/);
  });
});

describe("CBAM certificates", () => {
  it("prices the Türkiye default with its 2026 mark-up", () => {
    expect(turkeyDefaultSee(72083900, 2026)).toBeCloseTo(2.6708, 4);
    expect(turkeyDefaultSee(72083900, 2028)).toBeCloseTo(3.1564, 4);
  });

  it("builds the free allocation adjustment from column A through the precursors", () => {
    const s = sefaActualCoil({ year: 2026, crudeSteelT: 180_200, hotRolledT: 171_200, pigIronT: 18_000 });
    expect(s.pig).toBeCloseTo(0.975 * 1.089, 6);
    expect(s.crude).toBeCloseTo(0.975 * 0.065 + (18_000 / 180_200) * 0.975 * 1.089, 6);
    expect(s.sefa).toBeCloseTo(0.2212, 4);
    expect(sefaDefaultCoil(2026)).toBeCloseTo(1.33575, 5);
  });

  it("compares verified actual data with the default value", () => {
    const c = compareWithDefault({ tonnes: 6_000, see: 0.354, sefaActual: 0.2212, cnCode: 72083900, year: 2026, priceEur: 82.32 });
    expect(c.actual.eurPerTonne).toBeCloseTo((0.354 - 0.2212) * 82.32, 4);
    expect(c.fallback.netPerTonne).toBeCloseTo(1.33505, 4);
    expect(c.fallback.eurPerTonne).toBeCloseTo(109.9, 1);
    expect(c.savingEur).toBeCloseTo(6_000 * (c.fallback.eurPerTonne - c.actual.eurPerTonne), 4);
  });

  it("never goes below zero", () => {
    expect(certificatesDue({ tonnes: 100, see: 0.05, sefa: 0.2, priceEur: 80 }).certificates).toBe(0);
  });

  it("charges more as the free allocation phases out", () => {
    const y26 = sefaActualCoil({ year: 2026, crudeSteelT: 180_200, hotRolledT: 171_200, pigIronT: 18_000 }).sefa;
    const y34 = sefaActualCoil({ year: 2034, crudeSteelT: 180_200, hotRolledT: 171_200, pigIronT: 18_000 }).sefa;
    expect(y34).toBe(0);
    expect(y26).toBeGreaterThan(y34);
  });
});
