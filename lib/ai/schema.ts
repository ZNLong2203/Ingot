import * as z from "zod/v4";

/**
 * What the model must return for one evidence document. Kept narrow on
 * purpose: the model reads and quotes, the deterministic engine calculates.
 */
export const extractedLine = z.object({
  stream: z
    .enum([
      "natural_gas",
      "electricity",
      "charge_carbon",
      "electrodes",
      "carbonates",
      "pig_iron",
      "scrap",
      "crude_steel",
      "hot_rolled",
      "other",
    ])
    .describe("Source stream or product the quantity belongs to"),
  month: z.string().describe("Calendar month the quantity refers to, as YYYY-MM"),
  quantity: z.number().describe("The number exactly as stated, converted from Turkish number format (1.234,5 → 1234.5)"),
  unit: z.enum(["kWh", "MWh", "Sm3", "t", "kg"]),
  sourceText: z.string().describe("Verbatim text from the document that states this quantity"),
  carbonFraction: z.number().nullable().describe("Carbon content as a fraction (0.86 for 86 %), only if the document states it"),
  carbonateKind: z.enum(["limestone", "dolomite"]).nullable(),
  gcvKcalPerSm3: z.number().nullable().describe("Gross (upper) calorific value in kcal/Sm3, only for natural gas and only if stated"),
});

export const extraction = z.object({
  documentType: z.enum(["gas_invoice", "electricity_invoice", "production_report", "delivery_note", "supplier_emissions_data", "other"]),
  documentNumber: z.string().nullable().describe("Invoice, report or delivery note number as printed"),
  issuer: z.string().nullable(),
  issueDate: z.string().nullable().describe("YYYY-MM-DD"),
  language: z.string().describe("ISO 639-1 code of the document's main language"),
  isCopy: z.boolean().describe("True if the document is marked as a copy, duplicate or re-sent version (e.g. KOPYA, SURET, COPY)"),
  lines: z.array(extractedLine),
  warnings: z.array(z.string()).describe("Anything a verifier should look at: unclear figures, estimates, missing periods"),
});

export type Extraction = z.infer<typeof extraction>;
export type ExtractedLine = z.infer<typeof extractedLine>;
