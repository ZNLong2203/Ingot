import { benchmarks, cbamFactor, cscf, defaultMarkup, turkeyDefaultRoute, turkeyDefaults } from "./rules";

/**
 * CBAM certificates due for one consignment (Reg. 2023/956 Art. 6(2), 9 and
 * 31; Implementing Reg. (EU) 2025/2620):
 *
 *   certificates = M × (SEE − SEFA_y) − carbon price deduction
 *
 * With actual data, SEFA follows the good's precursors (eq. 2 and 4):
 *   SEFA_g = CBAM_y × CSCF_y × BM*_g + Σ m_i × SEFA_i     (column A)
 * With default values (eq. 6):
 *   SEFA_g = CBAM_y × CSCF_y × BM_g(route)                (column B)
 *
 * No article states a floor at zero; the demo floors each line at zero.
 */

export function factorFor(year: number): number {
  return cbamFactor[year] ?? (year < 2026 ? 1 : 0);
}

/** SEFA of the mill's coil with actual data: coil ← crude steel (EAF, route E) ← verified pig iron. */
export function sefaActualCoil(opts: { year: number; crudeSteelT: number; hotRolledT: number; pigIronT: number }): {
  sefa: number;
  pig: number;
  crude: number;
  mCrude: number;
  mPig: number;
} {
  const k = factorFor(opts.year) * cscf;
  const pig = k * benchmarks.pigIron.columnA;
  const mPig = opts.crudeSteelT > 0 ? opts.pigIronT / opts.crudeSteelT : 0;
  const crude = k * benchmarks.crudeSteel.columnA.E + mPig * pig;
  const mCrude = opts.hotRolledT > 0 ? opts.crudeSteelT / opts.hotRolledT : 0;
  return { sefa: k * benchmarks.hotRolled.columnA + mCrude * crude, pig, crude, mCrude, mPig };
}

export function sefaDefaultCoil(year: number): number {
  return factorFor(year) * cscf * benchmarks.hotRolled.columnB[turkeyDefaultRoute];
}

export interface CostResult {
  see: number;
  sefa: number;
  netPerTonne: number;
  certificates: number;
  eur: number;
  eurPerTonne: number;
}

export function certificatesDue(i: { tonnes: number; see: number; sefa: number; priceEur: number; carbonPricePaidEurPerTonne?: number }): CostResult {
  const deduction = (i.carbonPricePaidEurPerTonne ?? 0) / i.priceEur;
  const netPerTonne = Math.max(0, i.see - i.sefa - deduction);
  const certificates = netPerTonne * i.tonnes;
  return { see: i.see, sefa: i.sefa, netPerTonne, certificates, eur: certificates * i.priceEur, eurPerTonne: netPerTonne * i.priceEur };
}

/** Türkiye's default value for a CN heading in a given import year, mark-up included. */
export function turkeyDefaultSee(cnCode: number, year: number): number {
  const heading = Number(String(cnCode).slice(0, 4));
  const d = turkeyDefaults[heading];
  if (!d) throw new Error(`No Türkiye default listed for CN ${heading}`);
  return d.value * (1 + defaultMarkup(year));
}

export interface Comparison {
  actual: CostResult;
  fallback: CostResult;
  savingEur: number;
  savingEurPerTonne: number;
}

/** What the importer pays with this verified statement, against the default value. */
export function compareWithDefault(opts: {
  tonnes: number;
  see: number;
  sefaActual: number;
  cnCode: number;
  year: number;
  priceEur: number;
}): Comparison {
  const actual = certificatesDue({ tonnes: opts.tonnes, see: opts.see, sefa: opts.sefaActual, priceEur: opts.priceEur });
  const fallback = certificatesDue({
    tonnes: opts.tonnes,
    see: turkeyDefaultSee(opts.cnCode, opts.year),
    sefa: sefaDefaultCoil(opts.year),
    priceEur: opts.priceEur,
  });
  return { actual, fallback, savingEur: fallback.eur - actual.eur, savingEurPerTonne: fallback.eurPerTonne - actual.eurPerTonne };
}
