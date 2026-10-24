/**
 * The CBAM parameters the demo prices with. Values are copied from the
 * Commission's published files; the legally binding versions are the
 * implementing regulations named next to each table.
 */

const DV_XLSX =
  "https://taxation-customs.ec.europa.eu/document/download/1c05d211-80cb-4aaa-8ef0-e08005a95d7e_en?filename=DV%20correcting%20act_final%20update_06.08.xlsx";
const BM_XLSX =
  "https://taxation-customs.ec.europa.eu/document/download/9877523c-2a02-4926-a211-aefae7cf6d0d_en?filename=CBAM%20Benchmarks_20260206.xlsx";
const PRICE_PAGE = "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/price-cbam-certificates_en";
const VERIFICATION_GUIDANCE =
  "https://taxation-customs.ec.europa.eu/document/download/030fe146-38e5-46b8-82b5-5f72da089a7b_en?filename=GUIDANCE%20ON%20CBAM%20VERIFICATION%20AND%20ACCREDITATION%20FOR%20VERIFIERS%20AND%20NATIONAL%20ACCREDITATION%20BODIES.pdf";

export const sources = {
  defaults: { label: "Default values, Implementing Reg. (EU) 2025/2621 as amended by 2026/1740 (Commission file of 10 Aug 2026)", url: DV_XLSX },
  benchmarks: { label: "CBAM benchmarks, Implementing Reg. (EU) 2025/2620 (Commission file of 6 Feb 2026)", url: BM_XLSX },
  prices: { label: "Price of CBAM certificates, European Commission", url: PRICE_PAGE },
  cbamFactor: { label: "CBAM factor schedule, Commission guidance on verification and accreditation, table 3", url: VERIFICATION_GUIDANCE },
};

/** Direct-emission default values for Türkiye, before the mark-up (t CO2e per tonne of good). */
export const turkeyDefaults: Record<number, { label: string; value: number }> = {
  7201: { label: "Pig iron", value: 1.85 },
  7208: { label: "Hot-rolled flat products", value: 2.428 },
  7209: { label: "Cold-rolled flat products", value: 2.51 },
  7213: { label: "Wire rod", value: 2.31 },
  7601: { label: "Unwrought aluminium", value: 1.7 },
};

/** Mark-up applied to default values by year of import (iron and steel, aluminium, cement). */
export function defaultMarkup(year: number): number {
  if (year <= 2026) return 0.1;
  if (year === 2027) return 0.2;
  return 0.3;
}

/**
 * Column B benchmarks for CN 7208 (whole production chain), by production
 * route indicator in the Commission's file: (C) 1.37, (D) 0.481, (E) 0.072.
 * Reading of the indicators, to be checked against Reg. 2025/2620:
 * (C) blast furnace / basic oxygen route, (D) direct reduction route,
 * (E) scrap-based electric arc furnace route.
 */
export const hotRolledBenchmarks = {
  C: { value: 1.37, route: "Blast furnace / basic oxygen furnace" },
  D: { value: 0.481, route: "Direct reduced iron / electric arc furnace" },
  E: { value: 0.072, route: "Scrap-based electric arc furnace" },
} as const;
export type RouteIndicator = keyof typeof hotRolledBenchmarks;

/** Share of free allocation still reflected in the CBAM obligation, by year (CSCF taken as 1). */
export const cbamFactor: Record<number, number> = {
  2026: 0.975,
  2027: 0.95,
  2028: 0.9,
  2029: 0.775,
  2030: 0.515,
  2031: 0.39,
  2032: 0.265,
  2033: 0.14,
  2034: 0,
};

/** Published CBAM certificate prices for goods imported in each quarter of 2026 (EUR per certificate). */
export const certificatePrices = [
  { quarter: "2026-Q1", eur: 75.36, published: "2026-04-07" },
  { quarter: "2026-Q2", eur: 75.28, published: "2026-07-06" },
  { quarter: "2026-Q3", eur: 82.32, published: "2026-10-05" },
] as const;

export const latestPrice = certificatePrices[certificatePrices.length - 1];
