import "server-only";
import { ApiError, FinishReason, GoogleGenAI, ThinkingLevel, Type, type Schema } from "@google/genai";
import { extraction, type Extraction } from "./schema";

export const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

const SYSTEM = `You read one evidence document for an EU CBAM emissions report of an iron and steel installation (scrap-based electric arc furnace with a hot strip mill). Documents may be in Turkish, English or Portuguese.

Extract every quantity a CBAM monitoring would use: fuel and electricity consumed, carbon-bearing inputs (charge carbon, graphite electrodes, limestone or dolomite), precursors such as pig iron, scrap charged, and production (crude steel, hot-rolled coil).

Rules:
- Report only what the document states. Never estimate, infer or fill a gap; if a number is unclear, leave it out and add a warning.
- Give one line per stream per month. Use the month the consumption or production happened, not the issue date.
- Copy the exact source text for each number so a verifier can find it.
- Turkish documents write 1.234.567,8 for 1234567.8. Convert numbers, never units: keep Sm3 as Sm3 and MWh as MWh. If an invoice states both Sm3 and kWh for gas, report Sm3 and the calorific value.
- Set isCopy when the document is stamped as a copy or re-sent version.
- Use null for any field the document does not state.`;

/** The same shape as `extraction` in schema.ts, in Gemini's schema dialect. Every field is required; absent values come back as null. */
const nullable = (type: Type, description?: string): Schema => ({ type, nullable: true, ...(description ? { description } : {}) });
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    documentType: { type: Type.STRING, enum: ["gas_invoice", "electricity_invoice", "production_report", "delivery_note", "supplier_emissions_data", "other"] },
    documentNumber: nullable(Type.STRING, "Invoice, report or delivery note number as printed"),
    issuer: nullable(Type.STRING),
    issueDate: nullable(Type.STRING, "YYYY-MM-DD"),
    language: { type: Type.STRING, description: "ISO 639-1 code of the document's main language" },
    isCopy: { type: Type.BOOLEAN, description: "True if stamped as a copy, duplicate or re-sent version (KOPYA, SURET, COPY)" },
    lines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          stream: {
            type: Type.STRING,
            enum: ["natural_gas", "electricity", "charge_carbon", "electrodes", "carbonates", "pig_iron", "scrap", "crude_steel", "hot_rolled", "other"],
          },
          month: { type: Type.STRING, description: "Calendar month the quantity refers to, YYYY-MM" },
          quantity: { type: Type.NUMBER, description: "The number as stated, converted from Turkish number format" },
          unit: { type: Type.STRING, enum: ["kWh", "MWh", "Sm3", "t", "kg"] },
          sourceText: { type: Type.STRING, description: "Verbatim text from the document that states this quantity" },
          carbonFraction: nullable(Type.NUMBER, "Carbon content as a fraction, only if stated"),
          carbonateKind: { type: Type.STRING, enum: ["limestone", "dolomite"], nullable: true },
          gcvKcalPerSm3: nullable(Type.NUMBER, "Gross calorific value in kcal/Sm3, natural gas only, only if stated"),
        },
        required: ["stream", "month", "quantity", "unit", "sourceText", "carbonFraction", "carbonateKind", "gcvKcalPerSm3"],
        propertyOrdering: ["stream", "month", "quantity", "unit", "sourceText", "carbonFraction", "carbonateKind", "gcvKcalPerSm3"],
      },
    },
    warnings: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Anything a verifier should look at" },
  },
  required: ["documentType", "documentNumber", "issuer", "issueDate", "language", "isCopy", "lines", "warnings"],
  propertyOrdering: ["documentType", "documentNumber", "issuer", "issueDate", "language", "isCopy", "lines", "warnings"],
};

let client: GoogleGenAI | null = null;

export function extractionAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export class ExtractionRefused extends Error {}
export class ExtractionBusy extends Error {}

export async function extractDocument(file: { bytes: Buffer; mediaType: string; name: string }): Promise<Extraction> {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { retryOptions: { attempts: 3, initialDelay: 1, maxDelay: 8 } } });
  let res;
  try {
    res = await client.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [{ inlineData: { mimeType: file.mediaType, data: file.bytes.toString("base64") } }, { text: `File name: ${file.name}. Extract the activity data.` }],
        },
      ],
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        responseSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        maxOutputTokens: 8192,
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) throw new ExtractionBusy("The model is busy; try again in a moment.");
    throw error;
  }

  const finish = res.candidates?.[0]?.finishReason;
  if (res.promptFeedback?.blockReason || finish === FinishReason.SAFETY || finish === FinishReason.PROHIBITED_CONTENT) {
    throw new ExtractionRefused("The model declined to read this document.");
  }
  if (!res.text) throw new Error(`No output (finish reason: ${finish ?? "unknown"})`);
  // The schema shapes the answer; zod checks it before anything downstream sees it.
  return extraction.parse(JSON.parse(res.text));
}
