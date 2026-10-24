import { ApiError } from "@google/genai";
import { NextResponse } from "next/server";
import { ZodError } from "zod/v4";
import { ExtractionBusy, ExtractionRefused, extractDocument, extractionAvailable, MODEL } from "@/lib/ai/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

/** The declared type must match the file's first bytes. */
function sniff(b: Buffer): string | null {
  if (b.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (b[0] === 0x89 && b.subarray(1, 4).toString("latin1") === "PNG") return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

// Best-effort limit per address, per server instance: the deployment pays
// for every call, and anyone can reach this route.
const WINDOW_MS = 60_000;
const LIMIT = 12;
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > LIMIT;
}

export async function GET() {
  return NextResponse.json({ available: extractionAvailable(), model: MODEL });
}

export async function POST(req: Request) {
  if (!extractionAvailable()) {
    return NextResponse.json({ error: "AI extraction is not configured on this deployment." }, { status: 503 });
  }
  // On Vercel the platform sets these; a client cannot choose its own bucket.
  const ip = req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many documents at once; wait a minute." }, { status: 429 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "Files up to 4 MB." }, { status: 413 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Send one file in the 'file' field." }, { status: 400 });
  if (!TYPES.has(file.type)) return NextResponse.json({ error: "PDF, PNG, JPEG or WebP only." }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Files up to 4 MB." }, { status: 413 });

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    if (sniff(bytes) !== file.type) return NextResponse.json({ error: "The file's contents do not match its type." }, { status: 415 });
    const started = Date.now();
    const result = await extractDocument({ bytes, mediaType: file.type, name: file.name.slice(0, 120) });
    return NextResponse.json({ result, model: MODEL, ms: Date.now() - started });
  } catch (error) {
    if (error instanceof ExtractionRefused) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof ExtractionBusy) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "The model's answer did not match the expected shape." }, { status: 502 });
    }
    if (error instanceof ApiError) return NextResponse.json({ error: `Model error ${error.status}` }, { status: 502 });
    console.error("extract failed", error);
    return NextResponse.json({ error: "Extraction failed." }, { status: 500 });
  }
}
