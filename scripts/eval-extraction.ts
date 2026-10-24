// Sends every sample document to a running app's /api/extract and compares
// what the model read with the answer key the samples were generated from.
//   npm run dev            (with GEMINI_API_KEY in .env)
//   node scripts/eval-extraction.ts [base-url]
import { readFile } from "node:fs/promises";
import { documents } from "../lib/samples/marmara.ts";

const BASE = process.argv[2] ?? "http://localhost:3000";

const status = await fetch(`${BASE}/api/extract`).then((r) => r.json());
if (!status.available) {
  console.error(`AI extraction is not configured at ${BASE} (set GEMINI_API_KEY in .env).`);
  process.exit(2);
}

type Line = { stream: string; month: string; quantity: number; unit: string; gcvKcalPerSm3?: number | null };
const toBase = (l: Line) => (l.unit === "kWh" ? { ...l, quantity: l.quantity / 1000, unit: "MWh" } : l.unit === "kg" ? { ...l, quantity: l.quantity / 1000, unit: "t" } : l);

let expected = 0;
let exact = 0;
let extra = 0;
let numbers = 0;
let copies = 0;
for (const d of documents) {
  const body = new FormData();
  body.append("file", new File([await readFile(`public/samples/${d.file}`)], d.file, { type: "application/pdf" }));
  const started = Date.now();
  const res = await fetch(`${BASE}/api/extract`, { method: "POST", body });
  const json = await res.json();
  if (!res.ok) {
    console.log(`${d.id}: ${json.error ?? res.status}`);
    expected += d.lines.length;
    continue;
  }
  const got: Line[] = json.result.lines.map(toBase);
  let ok = 0;
  for (const want of d.lines.map((l) => toBase(l as Line))) {
    const hit = got.find((g) => g.stream === want.stream && g.month === want.month && g.unit === want.unit && Math.abs(g.quantity - want.quantity) <= Math.abs(want.quantity) * 0.001);
    if (hit) ok++;
    if (want.gcvKcalPerSm3) {
      numbers++;
      if (hit?.gcvKcalPerSm3 === want.gcvKcalPerSm3) numbers--;
    }
  }
  const relevant = got.filter((g) => g.stream !== "other").length;
  extra += Math.max(0, relevant - d.lines.length);
  expected += d.lines.length;
  exact += ok;
  const copyOk = json.result.isCopy === d.id.endsWith("-copy");
  if (copyOk) copies++;
  console.log(
    `${d.id.padEnd(18)} ${String(ok).padStart(2)}/${d.lines.length} lines exact · number ${json.result.documentNumber === d.documentNumber ? "ok" : `read as ${json.result.documentNumber}`} · copy flag ${copyOk ? "ok" : "wrong"} · ${((Date.now() - started) / 1000).toFixed(1)} s`,
  );
}
console.log(`\n${exact}/${expected} lines exact (stream, month, unit and quantity within 0.1 %), ${extra} extra lines, ${copies}/${documents.length} copy flags right, ${numbers} calorific values missed.`);
