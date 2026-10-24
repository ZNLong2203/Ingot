import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { extraction, type Extraction } from "./schema";

export const MODEL = "claude-opus-5-5";

const SYSTEM = `You read one evidence document for an EU CBAM emissions report of an iron and steel installation (scrap-based electric arc furnace with a hot strip mill). Documents may be in Turkish, English or Portuguese.

Extract every quantity a CBAM monitoring would use: fuel and electricity consumed, carbon-bearing inputs (charge carbon, graphite electrodes, limestone or dolomite), precursors such as pig iron, scrap charged, and production (crude steel, hot-rolled coil).

Rules:
- Report only what the document states. Never estimate, infer or fill a gap; if a number is unclear, leave it out and add a warning.
- Give one line per stream per month. Use the month the consumption or production happened, not the issue date.
- Copy the exact source text for each number so a verifier can find it.
- Turkish documents write 1.234.567,8 for 1234567.8. Convert numbers, never units: keep Sm3 as Sm3 and MWh as MWh. If an invoice states both Sm3 and kWh for gas, report Sm3 and the calorific value.
- Set isCopy when the document is stamped as a copy or re-sent version.`;

let client: Anthropic | null = null;

export function extractionAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export class ExtractionRefused extends Error {}

export async function extractDocument(file: { bytes: Buffer; mediaType: string; name: string }): Promise<Extraction> {
  client ??= new Anthropic();
  const data = file.bytes.toString("base64");
  const source =
    file.mediaType === "application/pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } } as const)
      : ({
          type: "image",
          source: { type: "base64", media_type: file.mediaType as "image/png" | "image/jpeg" | "image/webp", data },
        } as const);

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(extraction) },
    messages: [
      {
        role: "user",
        content: [source, { type: "text", text: `File name: ${file.name}. Extract the activity data.` }],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new ExtractionRefused("The model declined to read this document.");
  if (!response.parsed_output) throw new Error(`No structured output (stop reason: ${response.stop_reason})`);
  return response.parsed_output;
}
