import type { Stream, Unit } from "@/lib/samples/marmara";
import { factors } from "./factors";

/**
 * Embedded emissions of hot-rolled steel from a scrap-based EAF mill, after
 * the Commission's methodology (Implementing Reg. (EU) 2025/2547):
 *
 *   EAF steelmaking   carbon mass balance: Σ carbon in − Σ carbon out
 *                     (scrap, pig iron, electrodes, charge carbon in; steel
 *                     out), plus raw carbonates charged      (Annex I 3.15.2.2)
 *   Hot rolling       combustion: fuel × NCV × EF × OF       (Annex II B.3.1.1)
 *   Precursors        EE_proc = AttrEm_proc + Σ M_i × SEE_i
 *   Good              SEE_g = EE_proc / AL_g
 *
 * Crude steel from the furnace is the internal precursor of the rolled
 * coil. Indirect emissions are computed and reported, but for iron and steel
 * only direct emissions count (Annex II of Regulation (EU) 2023/956).
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
  pigIronT: number;
  eaf: { ownDirectT: number; directT: number; indirectT: number; seeDirect: number; seeIndirect: number };
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

  // ── EAF steelmaking: carbon mass balance ─────────────────────────────────
  const balance = (stream: Stream, label: string, factor: { value: number }, sign = 1) => {
    const ls = by(stream);
    const q = sum(ls);
    trace.push({
      process: "eaf",
      stream,
      label,
      quantity: q,
      unit: "t",
      formula: `${sign < 0 ? "− " : ""}${fmt(q, q % 1 ? 1 : 0)} t × ${factor.value} t CO2/t`,
      directT: sign * q * factor.value,
      indirectT: 0,
      lineIds: ids(ls),
    });
  };
  balance("scrap", "Steel scrap charged (carbon in)", f.scrapEf);
  balance("pig_iron", "Pig iron charged (carbon in)", f.pigIronCarbonEf);
  balance("electrodes", "Graphite electrodes consumed", f.electrodeEf);
  balance("charge_carbon", "Charge carbon (anthracite)", f.chargeCarbonEf);
  balance("crude_steel", "Crude steel cast (carbon out)", f.steelEf, -1);

  const carbonates = by("carbonates");
  trace.push({
    process: "eaf",
    stream: "carbonates",
    label: "Raw dolomite charged (decomposition)",
    quantity: sum(carbonates),
    unit: "t",
    formula: `${fmt(sum(carbonates))} t × ${f.dolomiteEf.value} t CO2/t`,
    directT: carbonates.reduce((s, l) => s + l.quantity * (l.carbonateKind === "limestone" ? f.limestoneEf.value : f.dolomiteEf.value), 0),
    indirectT: 0,
    lineIds: ids(carbonates),
  });

  const electricity = by("electricity");
  const mwh = electricity.reduce((s, l) => s + (l.unit === "kWh" ? l.quantity / 1000 : l.quantity), 0);
  if (mwh <= 0) missing.push("electricity consumption");
  trace.push({
    process: "eaf",
    stream: "electricity",
    label: "Grid electricity, whole site (indirect)",
    quantity: mwh,
    unit: "MWh",
    formula: `${fmt(mwh)} MWh × ${gridEf} t CO2e/MWh`,
    directT: 0,
    indirectT: mwh * gridEf,
    lineIds: ids(electricity),
  });

  const ownDirect = trace.filter((r) => r.process === "eaf").reduce((s, r) => s + r.directT, 0);

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

  // ── Hot rolling: reheating furnace ───────────────────────────────────────
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
    pigIronT,
    eaf: { ownDirectT: ownDirect, directT: eafDirect, indirectT: eafIndirect, seeDirect: seeCrudeDirect, seeIndirect: seeCrudeIndirect },
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
