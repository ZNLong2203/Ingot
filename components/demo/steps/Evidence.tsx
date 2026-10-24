"use client";

/* eslint-disable @next/next/no-img-element -- static previews of local PDFs */
import { useEffect, useState } from "react";
import { bytesToHex } from "viem";
import type { Extraction } from "@/lib/ai/schema";
import { referenceExtraction, readDocuments } from "@/lib/demo/derive";
import { setRun, setState, useDemo, type DocRun } from "@/lib/demo/store";
import { documents, type SampleDocument } from "@/lib/samples/marmara";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Callout } from "@/components/ui/Kit";
import { useDerived } from "../hooks";
import { StepIntro } from "../StepIntro";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sha256(blob: Blob) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())));
}

async function askModel(file: File): Promise<{ result: Extraction; ms: number }> {
  const body = new FormData();
  body.append("file", file);
  const r = await fetch("/api/extract", { method: "POST", body });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
  return json;
}

async function readSample(d: SampleDocument, ai: boolean) {
  setRun(d.id, { status: "reading", error: undefined });
  const blob = await (await fetch(`/samples/${d.file}`)).blob();
  const hash = await sha256(blob);
  if (ai) {
    try {
      const { result, ms } = await askModel(new File([blob], d.file, { type: "application/pdf" }));
      setRun(d.id, { status: "done", source: "ai", extraction: result, ms, sha256: hash });
      return;
    } catch (e) {
      setRun(d.id, { error: `AI reading failed (${(e as Error).message}); the reference reading is shown instead.` });
    }
  } else {
    await sleep(250 + Math.random() * 450);
  }
  setRun(d.id, { status: "done", source: "reference", extraction: referenceExtraction(d), sha256: hash });
}

export function useAiStatus() {
  const [ai, setAi] = useState<{ available: boolean; model?: string } | null>(null);
  useEffect(() => {
    fetch("/api/extract")
      .then((r) => r.json())
      .then(setAi)
      .catch(() => setAi({ available: false }));
  }, []);
  return ai;
}

function status(run: DocRun | undefined) {
  if (!run || run.status === "idle") return <Badge>not read</Badge>;
  if (run.status === "reading") return <Badge tone="chain">reading…</Badge>;
  if (run.status === "error") return <Badge tone="refused">error</Badge>;
  return (
    <Badge tone={run.source === "ai" ? "verified" : "neutral"}>
      <Icon name="check" className="h-3 w-3" />
      {run.extraction?.lines.length} {run.extraction?.lines.length === 1 ? "line" : "lines"} · {run.source === "ai" ? `AI${run.ms ? ` ${(run.ms / 1000).toFixed(1)} s` : ""}` : "reference"}
    </Badge>
  );
}

export function Evidence({ onNext }: { onNext: () => void }) {
  const s = useDemo();
  const ai = useAiStatus();
  const { lines, duplicates } = useDerived();
  const [open, setOpen] = useState<string | null>(null);
  const read = readDocuments(s);
  const reading = documents.some((d) => s.runs[d.id]?.status === "reading");
  const allRead = documents.every((d) => s.runs[d.id]?.status === "done");

  async function readAll() {
    const todo = documents.filter((d) => s.runs[d.id]?.status !== "done");
    await Promise.all(todo.map((d) => readSample(d, Boolean(ai?.available))));
  }

  async function upload(file: File) {
    const id = `upload-${Date.now()}`;
    setState((st) => ({ uploads: [...st.uploads, { id, name: file.name, run: { status: "reading" } }] }));
    const patch = (run: DocRun) =>
      setState((st) => ({ uploads: st.uploads.map((u) => (u.id === id ? { ...u, run: { ...u.run, ...run } } : u)) }));
    try {
      const { result, ms } = await askModel(file);
      patch({ status: "done", source: "ai", extraction: result, ms, sha256: await sha256(file) });
    } catch (e) {
      patch({ status: "error", error: (e as Error).message });
    }
  }

  return (
    <div className="space-y-6">
      <StepIntro
        role="mill"
        who="Marmara Demo Steel · the mill"
        lead={
          <>
            Seven documents from the quarter. Gemini reads each one and <span className="text-mill">quotes the line behind every number</span>.
          </>
        }
        action={
          <Button onClick={readAll} disabled={reading || allRead || !ai} tone={allRead ? "done" : "mill"}>
            <Icon name="spark" />
            {allRead ? "All documents read" : reading ? "Reading…" : `Read all ${documents.length} documents`}
          </Button>
        }
        more={
          <p>
            Turkish gas invoices, the electricity statement, the plant&apos;s production report and the delivery note for imported pig iron.
            The model only reads: it returns each number with the text it came from and does no arithmetic. The engine does the maths in the
            next step.
          </p>
        }
      />

      {ai && !ai.available && (
        <Callout tone="info" title="AI reading is switched off on this deployment">
          Each document shows its reference reading instead. Put a <code className="font-mono text-xs">GEMINI_API_KEY</code> in{" "}
          <code className="font-mono text-xs">.env</code> to watch Gemini read them.
        </Callout>
      )}
      {ai?.available && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Icon name="spark" className="h-3.5 w-3.5 text-mill" /> Reading with {ai.model}. Files are sent to the model and not stored.
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {documents.map((d) => {
          const run = s.runs[d.id];
          return (
            <li key={d.id} className={`card overflow-hidden ${d.id.endsWith("-copy") && run?.status === "done" ? "ring-2 ring-warn/50" : ""}`}>
              <a href={`/samples/${d.file}`} target="_blank" rel="noreferrer" className="block aspect-[4/3] overflow-hidden border-b border-line bg-white">
                <img src={`/samples/${d.file.replace(/\.pdf$/, ".png")}`} alt={`First page of ${d.title}`} className="w-full object-cover object-top" />
              </a>
              <div className="space-y-1.5 p-2.5">
                <p className="text-sm font-medium leading-snug">{d.title}</p>
                <p className="font-mono text-[11px] text-muted">
                  {d.documentNumber} · {d.language.toUpperCase()}
                </p>
                {status(run)}
                {run?.error && <p className="text-xs text-warn">{run.error}</p>}
              </div>
            </li>
          );
        })}
      </ul>

      {ai?.available && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
          <Icon name="doc" />
          <span className="underline decoration-dotted underline-offset-2">Try your own invoice or report</span>
          <span className="text-xs text-muted">(PDF or image, up to 4 MB; shown below, not counted in the demo statement)</span>
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {duplicates.length > 0 && (
        <Callout tone="warn" title="Caught a document that was sent twice">
          {duplicates.map((d) => (
            <p key={d.dropped}>
              &ldquo;{d.dropped}&rdquo; repeats invoice <span className="font-mono font-semibold">{d.number}</span>. Left out, so August&apos;s gas
              is counted once.
            </p>
          ))}
        </Callout>
      )}

      {read.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-mill-soft/50 px-4 py-2.5 text-sm font-semibold">
            <Icon name="doc" className="h-4 w-4 text-mill" /> What was read
            <span className="rounded-full bg-verified-soft px-2 py-0.5 text-xs text-verified">{lines.filter((l) => !l.excluded).length} lines counted</span>
            {lines.some((l) => l.excluded) && (
              <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs text-warn">{lines.filter((l) => l.excluded).length} left out</span>
            )}
          </div>
          <ul className="divide-y divide-line">
            {read.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setOpen(open === d.id ? null : d.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-paper-2"
                  aria-expanded={open === d.id}
                >
                  <span>
                    {d.title}{" "}
                    <span className="font-mono text-xs text-muted">
                      {d.extraction.documentNumber} · {d.extraction.lines.length} {d.extraction.lines.length === 1 ? "line" : "lines"}
                      {d.extraction.isCopy ? " · marked as a copy" : ""}
                    </span>
                  </span>
                  <Icon name="arrow" className={`h-4 w-4 text-muted transition-transform ${open === d.id ? "rotate-90" : ""}`} />
                </button>
                {open === d.id && (
                  <div className="overflow-x-auto px-4 pb-3">
                    <table className="w-full text-left text-xs">
                      <thead className="text-muted">
                        <tr>
                          <th className="py-1 pr-3 font-medium">Stream</th>
                          <th className="py-1 pr-3 font-medium">Month</th>
                          <th className="py-1 pr-3 text-right font-medium">Quantity</th>
                          <th className="py-1 font-medium">Read from</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.extraction.lines.map((l, i) => (
                          <tr key={i} className="border-t border-line align-top">
                            <td className="py-1.5 pr-3">{l.stream.replace("_", " ")}</td>
                            <td className="num py-1.5 pr-3">{l.month}</td>
                            <td className="num py-1.5 pr-3 text-right">
                              {l.quantity.toLocaleString("en-US")} {l.unit}
                            </td>
                            <td className="py-1.5 font-mono text-[11px] text-ink-2">&ldquo;{l.sourceText}&rdquo;</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {d.extraction.warnings.length > 0 && <p className="mt-2 text-xs text-warn">Model notes: {d.extraction.warnings.join(" · ")}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!documents.every((d) => s.runs[d.id]?.status === "done")} tone="engine">
          Calculate embedded emissions <Icon name="arrow" />
        </Button>
      </div>
    </div>
  );
}
