import { cbamFactor, defaultMarkup, hotRolledBenchmarks, turkeyDefaults, type RouteIndicator } from "./rules";

/**
 * CBAM certificates due for one consignment, after the Commission's formula:
 *
 *   certificates = q × (SEE − SEFA_y) − carbon price paid / certificate price
 *   SEFA_y       = CBAM factor_y × benchmark of the production route
 *
 * floored at zero. With default values the route is unknown; the demo pairs
 * them with the route (C) benchmark, which is an assumption stated on the
 * method page.
 */

export interface CostInput {
  tonnes: number;
  /** Specific direct embedded emissions, t CO2e per tonne. */
  see: number;
  route: RouteIndicator;
  year: number;
  priceEur: number;
  /** Carbon price effectively paid at origin, EUR per tonne of good. */
  carbonPricePaidEurPerTonne?: number;
}

export interface CostResult {
  see: number;
  sefa: number;
  netPerTonne: number;
  certificates: number;
  eur: number;
  eurPerTonne: number;
}

export function certificatesDue(i: CostInput): CostResult {
  const factor = cbamFactor[i.year] ?? (i.year < 2026 ? 1 : 0);
  const sefa = factor * hotRolledBenchmarks[i.route].value;
  const deduction = (i.carbonPricePaidEurPerTonne ?? 0) / i.priceEur;
  const netPerTonne = Math.max(0, i.see - sefa - deduction);
  const certificates = netPerTonne * i.tonnes;
  return {
    see: i.see,
    sefa,
    netPerTonne,
    certificates,
    eur: certificates * i.priceEur,
    eurPerTonne: netPerTonne * i.priceEur,
  };
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
  cnCode: number;
  route: RouteIndicator;
  year: number;
  priceEur: number;
}): Comparison {
  const actual = certificatesDue({ tonnes: opts.tonnes, see: opts.see, route: opts.route, year: opts.year, priceEur: opts.priceEur });
  const fallback = certificatesDue({
    tonnes: opts.tonnes,
    see: turkeyDefaultSee(opts.cnCode, opts.year),
    route: "C",
    year: opts.year,
    priceEur: opts.priceEur,
  });
  return {
    actual,
    fallback,
    savingEur: fallback.eur - actual.eur,
    savingEurPerTonne: fallback.eurPerTonne - actual.eurPerTonne,
  };
}
