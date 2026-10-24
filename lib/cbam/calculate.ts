import type { Stream, Unit } from "@/lib/samples/marmara";
import { factors } from "./factors";

/**
 * Embedded emissions of hot-rolled steel from a scrap-based EAF mill, after
 * the Commission's methodology (Implementing Reg. (EU) 2025/2547, as quoted
 * in Guidance No. 3):
 *
 *   Em (combustion)   = AD × EF × OF,   AD = fuel quantity × NCV
 *   Em (process)      = AD × EF
 *   EE_proc           = AttrEm_proc + Σ M_i × SEE_i          (precursors)
 *   SEE_g             = EE_proc / AL_g
 *
 * Two production processes: EAF steelmaking (crude steel) feeds hot rolling
 * (the CBAM good). Indirect emissions are computed and reported, but for
 * iron and steel only direct emissions count towards the CBAM obligation
 * (Annex II of Regulation (EU) 2023/956).
 */

export interface ActivityLine {
  id: string;
  stream: Stream;
  month: string;
  quantity: number;
  unit: Unit;
  documentId: string;
  documentNumber?: string;
  sourceText?: string;
  carbonFraction?: number;
  carbonateKind?: "limestone" | "dolomite";
  gcvKcalPerSm3?: number;
  /** Set when a line must not be counted, with the reason shown to the verifier. */
  excluded?: string;
}

export interface PrecursorInput {
  allocationId: string;
  label: string;
  quantityTonnes: number;
  directKgPerTonne: number;
  indirectKgPerTonne: number;
}

export interface TraceRow {
  process: "eaf" | "rolling";
  stream: Stream | "precursor";
  label: string;
  quantity: number;
  unit: string;
  formula: string;
  directT: number;
  indirectT: number;
  lineIds: string[];
}

export interface Result {
  trace: TraceRow[];
  crudeSteelT: number;
  hotRolledT: number;
  eaf: { directT: number; indirectT: number; seeDirect: number; seeIndirect: number };
  rolling: { directT: number; indirectT: number };
  precursorDirectT: number;
  precursorIndirectT: number;
  /** Specific embedded emissions of the good, t CO2e per tonne. */
  seeDirect: number;
  seeIndirect: number;
  /** The same, as whole kg per tonne rounded up, for the on-chain statement. */
  directKgPerTonne: number;
  indirectKgPerTonne: number;
  missing: string[];
}

const sum = (lines: ActivityLine[]) => lines.reduce((s, l) => s + l.quantity, 0);
const f = factors;

/** Gas invoices state Sm3 and the gross calorific value; return net energy in TJ. */
export function gasNetTj(line: ActivityLine): number {
  const kwhGross =
    line.unit === "kWh" ? line.quantity : line.quantity * (line.gcvKcalPerSm3 ?? NaN) * f.kcalToKwh.value;
  return kwhGross * 3.6e-6 * f.naturalGasNcvPerGcv.value;
}

export function calculate(all: ActivityLine[], precursors: PrecursorInput[], gridEf = f.gridEfTurkey.value): Result {
  const lines = all.filter((l) => !l.excluded);
  const by = (s: Stream) => lines.filter((l) => l.stream === s);
  const ids = (ls: ActivityLine[]) => ls.map((l) => l.id);
  const missing: string[] = [];
  const trace: TraceRow[] = [];

  const crude = by("crude_steel");
  const hot = by("hot_rolled");
  const crudeSteelT = sum(crude);
  const hotRolledT = sum(hot);
  if (crudeSteelT <= 0) missing.push("crude steel production");
  if (hotRolledT <= 0) missing.push("hot-rolled output");

  // ── EAF steelmaking ──────────────────────────────────────────────────────
  const carbon = by("charge_carbon");
  const carbonT = carbon.reduce((s, l) => s + l.quantity * (l.carbonFraction ?? 0), 0);
  if (carbon.some((l) => l.carbonFraction == null)) missing.push("carbon content of charge carbon");
  trace.push({
    process: "eaf",
    stream: "charge_carbon",
    label: "Charge carbon (anthracite)",
    quantity: sum(carbon),
    unit: "t",
    formula: `${fmt(sum(carbon))} t × carbon content × ${f.co2PerCarbon.value.toFixed(3)} t CO2/t C`,
    directT: carbonT * f.co2PerCarbon.value,
    indirectT: 0,
    lineIds: ids(carbon),
  });

  const electrodes = by("electrodes");
  trace.push({
    process: "eaf",
    stream: "electrodes",
    label: "Graphite electrodes consumed",
    quantity: sum(electrodes),
    unit: "t",
    formula: `${fmt(sum(electrodes))} t × ${f.electrodeEf.value} t CO2/t`,
    directT: sum(electrodes) * f.electrodeEf.value,
    indirectT: 0,
    lineIds: ids(electrodes),
  });

  const carbonates = by("carbonates");
  const carbonateCo2 = carbonates.reduce(
    (s, l) => s + l.quantity * (l.carbonateKind === "limestone" ? f.limestoneEf.value : f.dolomiteEf.value),
    0,
  );
  trace.push({
    process: "eaf",
    stream: "carbonates",
    label: "Raw dolomite charged",
    quantity: sum(carbonates),
    unit: "t",
    formula: `${fmt(sum(carbonates))} t × ${f.dolomiteEf.value} t CO2/t (stoichiometric)`,
    directT: carbonateCo2,
    indirectT: 0,
    lineIds: ids(carbonates),
  });

  const electricity = by("electricity");
  const mwh = electricity.reduce((s, l) => s + (l.unit === "kWh" ? l.quantity / 1000 : l.quantity), 0);
  if (mwh <= 0) missing.push("electricity consumption");
  trace.push({
    process: "eaf",
    stream: "electricity",
    label: "Electricity from the grid (whole site)",
    quantity: mwh,
    unit: "MWh",
    formula: `${fmt(mwh)} MWh × ${gridEf} t CO2/MWh (indirect)`,
    directT: 0,
    indirectT: mwh * gridEf,
    lineIds: ids(electricity),
  });

  let precursorDirectT = 0;
  let precursorIndirectT = 0;
  for (const p of precursors) {
    const d = (p.quantityTonnes * p.directKgPerTonne) / 1000;
    const i = (p.quantityTonnes * p.indirectKgPerTonne) / 1000;
    precursorDirectT += d;
    precursorIndirectT += i;
    trace.push({
      process: "eaf",
      stream: "precursor",
      label: p.label,
      quantity: p.quantityTonnes,
      unit: "t",
      formula: `${fmt(p.quantityTonnes)} t × ${(p.directKgPerTonne / 1000).toFixed(3)} t CO2e/t (verified upstream)`,
      directT: d,
      indirectT: i,
      lineIds: [],
    });
  }
  const pigIronT = sum(by("pig_iron"));
  const deliveredT = precursors.reduce((s, p) => s + p.quantityTonnes, 0);
  if (pigIronT > 0 && Math.abs(pigIronT - deliveredT) > 0.5) {
    missing.push(`pig iron charged (${fmt(pigIronT)} t) does not match verified precursor allocations (${fmt(deliveredT)} t)`);
  }

  const eafDirect = trace.filter((r) => r.process === "eaf").reduce((s, r) => s + r.directT, 0);
  const eafIndirect = trace.filter((r) => r.process === "eaf").reduce((s, r) => s + r.indirectT, 0);

  // ── Hot rolling ──────────────────────────────────────────────────────────
  const gas = by("natural_gas");
  const gasTj = gas.reduce((s, l) => s + gasNetTj(l), 0);
  if (gas.some((l) => l.unit === "Sm3" && !l.gcvKcalPerSm3)) missing.push("gas calorific value");
  trace.push({
    process: "rolling",
    stream: "natural_gas",
    label: "Natural gas, reheating furnace",
    quantity: sum(gas),
    unit: gas[0]?.unit ?? "Sm3",
    formula: `${fmt(gasTj, 1)} TJ (NCV) × ${f.naturalGasEf.value} t CO2/TJ × ${f.naturalGasOxidation.value}`,
    directT: gasTj * f.naturalGasEf.value * f.naturalGasOxidation.value,
    indirectT: 0,
    lineIds: ids(gas),
  });

  const rollingDirect = trace.filter((r) => r.process === "rolling").reduce((s, r) => s + r.directT, 0);
  const rollingIndirect = 0;

  // Crude steel is the internal precursor of the rolled good.
  const seeCrudeDirect = crudeSteelT > 0 ? eafDirect / crudeSteelT : 0;
  const seeCrudeIndirect = crudeSteelT > 0 ? eafIndirect / crudeSteelT : 0;
  const seeDirect = hotRolledT > 0 ? (rollingDirect + crudeSteelT * seeCrudeDirect) / hotRolledT : 0;
  const seeIndirect = hotRolledT > 0 ? (rollingIndirect + crudeSteelT * seeCrudeIndirect) / hotRolledT : 0;

  return {
    trace,
    crudeSteelT,
    hotRolledT,
    eaf: { directT: eafDirect, indirectT: eafIndirect, seeDirect: seeCrudeDirect, seeIndirect: seeCrudeIndirect },
    rolling: { directT: rollingDirect, indirectT: rollingIndirect },
    precursorDirectT,
    precursorIndirectT,
    seeDirect,
    seeIndirect,
    directKgPerTonne: Math.ceil(seeDirect * 1000),
    indirectKgPerTonne: Math.ceil(seeIndirect * 1000),
    missing,
  };
}

export function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
