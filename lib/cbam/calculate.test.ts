import { describe, expect, it } from "vitest";
import { documents, supplier } from "@/lib/samples/marmara";
import { calculate, gasNetTj, type ActivityLine, type PrecursorInput } from "./calculate";
import { certificatesDue, compareWithDefault, turkeyDefaultSee } from "./cost";

function referenceLines(includeCopy = false): ActivityLine[] {
  return documents
    .filter((d) => includeCopy || !d.id.endsWith("-copy"))
    .flatMap((d) =>
      d.lines
        .filter((l) => d.kind !== "delivery_note")
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

  it("adds up each source stream with its factor", () => {
    const row = (s: string) => r.trace.find((t) => t.stream === s)!;
    expect(row("natural_gas").directT).toBeCloseTo(12_240.3, 0);
    expect(row("charge_carbon").directT).toBeCloseTo(6_815.9, 0);
    expect(row("electrodes").directT).toBeCloseTo(1_057.5, 0);
    expect(row("carbonates").directT).toBeCloseTo(574.8, 0);
    expect(row("precursor").directT).toBe(34_380);
  });

  it("produces specific embedded emissions for the rolled good", () => {
    expect(r.crudeSteelT).toBe(180_200);
    expect(r.hotRolledT).toBe(171_200);
    expect(r.seeDirect).toBeCloseTo(0.3217, 4);
    expect(r.directKgPerTonne).toBe(322);
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

  it("compares verified actual data with the default value", () => {
    const c = compareWithDefault({ tonnes: 6_000, see: 0.322, cnCode: 72083900, route: "E", year: 2026, priceEur: 82.32 });
    expect(c.actual.sefa).toBeCloseTo(0.0702, 4);
    expect(c.actual.eurPerTonne).toBeCloseTo(20.73, 2);
    expect(c.fallback.eurPerTonne).toBeCloseTo(109.9, 1);
    expect(c.savingEur).toBeCloseTo(6_000 * (109.9 - 20.73), -2);
  });

  it("never goes below zero and falls as the free allocation phases out", () => {
    expect(certificatesDue({ tonnes: 100, see: 0.05, route: "E", year: 2026, priceEur: 80 }).certificates).toBe(0);
    const y26 = certificatesDue({ tonnes: 1, see: 0.322, route: "E", year: 2026, priceEur: 80 }).certificates;
    const y34 = certificatesDue({ tonnes: 1, see: 0.322, route: "E", year: 2034, priceEur: 80 }).certificates;
    expect(y34).toBeCloseTo(0.322, 6);
    expect(y34).toBeGreaterThan(y26);
  });
});
