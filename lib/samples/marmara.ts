/**
 * The demo installation and its first-quarter evidence. Every company,
 * person and number here is fictional; the quantities are chosen to sit
 * inside published ranges for scrap-based electric arc furnace steelmaking
 * with a hot strip mill (see docs/method.md).
 *
 * The same data renders the sample PDFs (scripts/make-samples.ts) and serves
 * as the reference answer for AI extraction (scripts/eval-extraction.ts), so
 * the two can never drift apart.
 */

export type Stream =
  | "natural_gas"
  | "electricity"
  | "charge_carbon"
  | "electrodes"
  | "carbonates"
  | "pig_iron"
  | "scrap"
  | "crude_steel"
  | "hot_rolled";

export type Unit = "kWh" | "MWh" | "Sm3" | "t";

export interface ReferenceLine {
  stream: Stream;
  month: string; // YYYY-MM
  quantity: number;
  unit: Unit;
  carbonFraction?: number;
  carbonateKind?: "limestone" | "dolomite";
  gcvKcalPerSm3?: number;
}

export interface SampleDocument {
  id: string;
  file: string; // under /samples
  title: string;
  kind: "gas_invoice" | "electricity_invoice" | "production_report" | "delivery_note";
  language: "tr" | "en";
  documentNumber: string;
  issuer: string;
  lines: ReferenceLine[];
  /** Why this document is in the set, shown to the verifier. */
  note?: string;
}

export const installation = {
  key: "TR-KOCAELI-EAF-01",
  name: "Marmara Demo Steel — Kocaeli works",
  operator: "Marmara Demo Steel A.Ş. (fictional)",
  country: "TR",
  city: "Kocaeli",
  route: "Scrap-based electric arc furnace + hot strip mill",
  good: { cnCode: 72083900, label: "Hot-rolled flat products of iron or non-alloy steel, in coils, < 3 mm (CN 7208 39 00)" },
  period: { from: "2026-07-01", to: "2026-10-01", label: "Q3 2026" },
};

export const supplier = {
  key: "BR-MG-BF-07",
  name: "Demo Gusa — Minas Gerais blast furnace 7",
  operator: "Demo Gusa Ltda. (fictional)",
  country: "BR",
  good: { cnCode: 72011011, label: "Non-alloy pig iron, ≤ 0.5 % phosphorus (CN 7201 10 11)" },
  period: { from: "2026-04-01", to: "2026-07-01", label: "Q2 2026" },
  quantityTonnes: 60_000,
  directKgPerTonne: 1_910,
  indirectKgPerTonne: 95,
  deliveryNote: "DN-2026-0642",
  deliveredTonnes: 18_000,
};

const MONTHS = ["2026-07", "2026-08", "2026-09"] as const;
const GCV = 9_155; // kcal/Sm3, as printed on the invoices

const gas = { "2026-07": 2_150_000, "2026-08": 1_995_000, "2026-09": 2_180_000 } as const;
const electricity = { "2026-07": 33_150, "2026-08": 30_880, "2026-09": 33_560 } as const;

export const production = {
  crude_steel: { "2026-07": 61_200, "2026-08": 56_900, "2026-09": 62_100 },
  hot_rolled: { "2026-07": 58_300, "2026-08": 54_000, "2026-09": 58_900 },
  scrap: { "2026-07": 60_500, "2026-08": 56_100, "2026-09": 61_600 },
  pig_iron: { "2026-07": 6_000, "2026-08": 6_000, "2026-09": 6_000 },
  electrodes: { "2026-07": 98.4, "2026-08": 91.0, "2026-09": 99.3 },
  charge_carbon: { "2026-07": 735, "2026-08": 683, "2026-09": 745 },
  carbonates: { "2026-07": 410, "2026-08": 380, "2026-09": 415 },
} as const;

/** kWh on a Turkish gas invoice: Sm3 x gross calorific value (kcal/Sm3) x 4.1868 kJ/kcal / 3600. */
export function gasKwh(sm3: number, gcv = GCV): number {
  return Math.round((sm3 * gcv * 4.1868) / 3600);
}

function gasInvoice(month: (typeof MONTHS)[number], number: string, copy = false): SampleDocument {
  const [y, m] = month.split("-");
  return {
    id: copy ? `gas-${month}-copy` : `gas-${month}`,
    file: copy ? `dogalgaz-${y}-${m}-kopya.pdf` : `dogalgaz-${y}-${m}.pdf`,
    title: copy ? `Natural gas invoice ${m}/${y} (re-sent copy)` : `Natural gas invoice ${m}/${y}`,
    kind: "gas_invoice",
    language: "tr",
    documentNumber: number,
    issuer: "Körfez Gaz Dağıtım A.Ş. (fictional)",
    lines: [{ stream: "natural_gas", month, quantity: gas[month], unit: "Sm3", gcvKcalPerSm3: GCV }],
    note: copy ? "The August invoice was e-mailed a second time with a KOPYA stamp." : undefined,
  };
}

export const documents: SampleDocument[] = [
  gasInvoice("2026-07", "KGD2026000737"),
  gasInvoice("2026-08", "KGD2026000814"),
  gasInvoice("2026-09", "KGD2026000898"),
  gasInvoice("2026-08", "KGD2026000814", true),
  {
    id: "electricity-q3",
    file: "elektrik-2026-q3.pdf",
    title: "Electricity statement Q3 2026",
    kind: "electricity_invoice",
    language: "tr",
    documentNumber: "KEP-2026-Q3-00871",
    issuer: "Kocaeli Enerji Perakende A.Ş. (fictional)",
    lines: MONTHS.map((month) => ({ stream: "electricity" as const, month, quantity: electricity[month], unit: "MWh" as const })),
  },
  {
    id: "production-q3",
    file: "uretim-raporu-2026-q3.pdf",
    title: "Production and consumption report Q3 2026",
    kind: "production_report",
    language: "tr",
    documentNumber: "MDS-URT-2026-Q3",
    issuer: "Marmara Demo Steel A.Ş. (fictional)",
    lines: MONTHS.flatMap((month) => [
      { stream: "crude_steel" as const, month, quantity: production.crude_steel[month], unit: "t" as const },
      { stream: "hot_rolled" as const, month, quantity: production.hot_rolled[month], unit: "t" as const },
      { stream: "scrap" as const, month, quantity: production.scrap[month], unit: "t" as const },
      { stream: "pig_iron" as const, month, quantity: production.pig_iron[month], unit: "t" as const },
      { stream: "electrodes" as const, month, quantity: production.electrodes[month], unit: "t" as const },
      {
        stream: "charge_carbon" as const,
        month,
        quantity: production.charge_carbon[month],
        unit: "t" as const,
        carbonFraction: 0.86,
      },
      {
        stream: "carbonates" as const,
        month,
        quantity: production.carbonates[month],
        unit: "t" as const,
        carbonateKind: "dolomite" as const,
      },
    ]),
  },
  {
    id: "delivery-note",
    file: "delivery-note-DN-2026-0642.pdf",
    title: "Pig iron delivery note DN-2026-0642",
    kind: "delivery_note",
    language: "en",
    documentNumber: "DN-2026-0642",
    issuer: "Demo Gusa Ltda. (fictional)",
    lines: [{ stream: "pig_iron", month: "2026-06", quantity: 18_000, unit: "t" }],
    note: "Its number is the shipment reference of an allocation on the ledger, which carries the smelter's verified emissions.",
  },
];

export const gcvKcalPerSm3 = GCV;
export const months = MONTHS;
