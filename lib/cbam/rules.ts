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
  cbamFactor: { label: "CBAM factor, Art. 10a(1a) of Directive 2003/87/EC as amended by Directive (EU) 2023/959", url: "http://data.europa.eu/eli/dir/2023/959/oj" },
  verification: { label: "Commission guidance on CBAM verification and accreditation", url: VERIFICATION_GUIDANCE },
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
 * CBAM benchmarks (Implementing Reg. (EU) 2025/2620, Annex point 5.3).
 * Column A (BM*) is process-related and used with actual data; column B
 * (BM) is the whole-chain benchmark used with default values, by production
 * route: (C) blast furnace / basic oxygen, (D) DRI / EAF, (E) scrap / EAF.
 * The default route for Türkiye, CN 7208, is (C) (Reg. 2025/2621 Annex I).
 */
export const benchmarks = {
  hotRolled: { cn: "7208", columnA: 0.044, columnB: { C: 1.37, D: 0.481, E: 0.072 } },
  crudeSteel: { cn: "7207 (continuously cast)", columnA: { C: 0.188, D: 0.065, E: 0.065 } },
  pigIron: { cn: "7201", columnA: 1.089, columnB: 1.21 },
} as const;
export type RouteIndicator = keyof typeof benchmarks.hotRolled.columnB;

/** Default production route for Türkiye's hot-rolled flat products in the default values act. */
export const turkeyDefaultRoute: RouteIndicator = "C";

/** Carbon steel weighting factor (CSCF), 100 % for 2026–2030 (Implementing Decision (EU) 2026/1862). */
export const cscf = 1;

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
