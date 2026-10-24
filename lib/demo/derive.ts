import type { Extraction } from "@/lib/ai/schema";
import type { ActivityLine } from "@/lib/cbam/calculate";
import { documents, type SampleDocument, type Stream } from "@/lib/samples/marmara";
import type { DemoState } from "./store";

const STREAMS = new Set<Stream>([
  "natural_gas",
  "electricity",
  "charge_carbon",
  "electrodes",
  "carbonates",
  "pig_iron",
  "scrap",
  "crude_steel",
  "hot_rolled",
]);

/** The answer key for a sample document, in the same shape the model returns. */
export function referenceExtraction(d: SampleDocument): Extraction {
  return {
    documentType: d.kind,
    documentNumber: d.documentNumber,
    issuer: d.issuer,
    issueDate: null,
    language: d.language,
    isCopy: d.id.endsWith("-copy"),
    lines: d.lines.map((l) => ({
      stream: l.stream,
      month: l.month,
      quantity: l.quantity,
      unit: l.unit,
      sourceText: `${d.documentNumber}: ${l.stream.replace("_", " ")} ${l.quantity} ${l.unit}`,
      carbonFraction: l.carbonFraction ?? null,
      carbonateKind: l.carbonateKind ?? null,
      gcvKcalPerSm3: l.gcvKcalPerSm3 ?? null,
    })),
    warnings: [],
  };
}

export interface DocView {
  id: string;
  title: string;
  extraction: Extraction;
  source: "ai" | "reference";
}

/** Every document that has been read, samples first, then uploads. */
export function readDocuments(state: DemoState): DocView[] {
  const out: DocView[] = [];
  for (const d of documents) {
    const run = state.runs[d.id];
    if (run?.status === "done" && run.extraction) out.push({ id: d.id, title: d.title, extraction: run.extraction, source: run.source ?? "ai" });
  }
  for (const u of state.uploads) {
    if (u.run.status === "done" && u.run.extraction) out.push({ id: u.id, title: u.name, extraction: u.run.extraction, source: "ai" });
  }
  return out;
}

const norm = (s: string | null | undefined) => (s ?? "").replace(/[\s\-_/]/g, "").toUpperCase();

/**
 * Activity lines from the documents read so far. A document that repeats
 * another's number is kept out, preferring the one not stamped as a copy,
 * and the reason is recorded so the verifier sees why.
 */
export function deriveLines(state: DemoState): { lines: ActivityLine[]; duplicates: { kept: string; dropped: string; number: string }[] } {
  const docs = readDocuments(state);
  const duplicates: { kept: string; dropped: string; number: string }[] = [];
  const byNumber = new Map<string, DocView>();
  const dropped = new Map<string, string>();

  // Originals first, so a copy never displaces the original.
  const ordered = [...docs].sort((a, b) => Number(a.extraction.isCopy) - Number(b.extraction.isCopy));
  for (const d of ordered) {
    const n = norm(d.extraction.documentNumber);
    if (!n) continue;
    const first = byNumber.get(n);
    if (first) {
      dropped.set(d.id, `Same document number as "${first.title}" (${d.extraction.documentNumber})${d.extraction.isCopy ? ", and stamped as a copy" : ""}`);
      duplicates.push({ kept: first.title, dropped: d.title, number: d.extraction.documentNumber ?? n });
    } else byNumber.set(n, d);
  }

  const lines: ActivityLine[] = [];
  // Uploads are there to try the reader; only the mill's own sample documents feed the statement.
  for (const d of docs.filter((x) => !x.id.startsWith("upload-"))) {
    d.extraction.lines.forEach((l, i) => {
      if (!STREAMS.has(l.stream as Stream)) return;
      const id = `${d.id}#${i}`;
      // A delivery note proves where pig iron came from; the production report counts how much was charged.
      if (d.extraction.documentType === "delivery_note") return;
      lines.push({
        id,
        stream: l.stream as Stream,
        month: l.month,
        quantity: l.unit === "kg" ? l.quantity / 1000 : l.quantity,
        unit: l.unit === "kg" ? "t" : l.unit,
        documentId: d.id,
        documentNumber: d.extraction.documentNumber ?? undefined,
        sourceText: l.sourceText,
        carbonFraction: l.carbonFraction ?? undefined,
        carbonateKind: l.carbonateKind ?? undefined,
        gcvKcalPerSm3: l.gcvKcalPerSm3 ?? undefined,
        excluded: dropped.get(d.id) ?? state.removed[id] ?? (l.quantity > 0 ? undefined : "Quantity must be positive"),
      });
    });
  }
  return { lines, duplicates };
}

/** Delivery note numbers for pig iron, which the ledger uses as shipment references. */
export function deliveryNoteNumbers(state: DemoState): string[] {
  return readDocuments(state)
    .filter((d) => d.extraction.documentType === "delivery_note" || d.extraction.lines.some((l) => l.stream === "pig_iron"))
    .filter((d) => d.extraction.documentType === "delivery_note")
    .map((d) => d.extraction.documentNumber)
    .filter((n): n is string => Boolean(n));
}
