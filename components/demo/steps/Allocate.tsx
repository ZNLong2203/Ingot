"use client";

import { useState } from "react";
import type { Hex } from "viem";
import { actors, type Role } from "@/lib/chain/actors";
import type { SandboxChain } from "@/lib/chain/sandbox";
import { commit, disclosuresFor } from "@/lib/demo/flow";
import { setState, useDemo, type DemoState, type Shipment } from "@/lib/demo/store";
import { act, getWorld, shipmentRef } from "@/lib/demo/world";
import { describe } from "@/lib/demo/explain";
import { buildPassport, type Passport } from "@/lib/passport";
import { demoPqKeys, fromBase64 } from "@/lib/crypto/pq";
import { installation } from "@/lib/samples/marmara";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Hash } from "@/components/ui/Hash";
import { Icon } from "@/components/ui/Icon";
import { Callout, More } from "@/components/ui/Kit";
import { Cheat, CheatHeader } from "../Cheat";
import { StepIntro } from "../StepIntro";
import { useLedgerRead } from "../hooks";

export const PRESETS: { recipient: Role; tonnes: number; mrn: string; city: string; flag: string }[] = [
  { recipient: "importer", tonnes: 6_000, mrn: "26TR341000EX000101", city: "Duisburg, Germany", flag: "🇩🇪" },
  { recipient: "importer2", tonnes: 4_500, mrn: "26TR341000EX000102", city: "Brescia, Italy", flag: "🇮🇹" },
];

export function passportFor(state: DemoState, chain: SandboxChain, s: Shipment): Passport | null {
  const signed = state.signed;
  if (!signed?.statementId) return null;
  const report = commit(signed.reportFields, signed.reportSeed);
  return buildPassport({
    chain,
    attestation: signed.attestation,
    signature: signed.signature,
    verifier: actors.verifier.address,
    statementId: signed.statementId,
    installation: { name: installation.name, country: installation.country },
    good: { cnCode: installation.good.cnCode, description: installation.good.label },
    period: { from: installation.period.from, to: installation.period.to },
    allocation: { id: s.allocationId, tonnes: s.tonnes, recipient: actors[s.recipient].address, shipmentRef: shipmentRef(s.mrn), reference: s.mrn },
    disclosures: disclosuresFor(report, ["directKgPerTonne", "sefaKgPerTonne2026", "route", "period", "cnCode"]),
    issuedAt: chain.now,
    pq: signed.pq ? { publicKey: demoPqKeys("verifier").publicKey, signature: fromBase64(signed.pq) } : undefined,
  });
}

export function encodePassport(p: Passport): string {
  const bytes = new TextEncoder().encode(JSON.stringify(p));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function download(p: Passport) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `cbam-passport-${p.credentialSubject.allocation.reference}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Allocate({ onNext }: { onNext: () => void }) {
  const s = useDemo();
  const statementId = s.signed?.statementId;
  const [form, setForm] = useState<{ recipient: Role; tonnes: string; mrn: string }>({ recipient: "importer", tonnes: "2500", mrn: "26TR341000EX000103" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const info = useLedgerRead(async (c) => {
    if (!statementId) return null;
    const st = await c.read("getStatement", [statementId]);
    return { quantity: Number(st.quantityKg) / 1000, allocated: Number(st.allocatedKg) / 1000, revoked: st.revoked, chain: c };
  }, [statementId]);

  if (!statementId) return <p className="text-sm text-muted">Record the statement first.</p>;

  async function allocate(recipient: Role, tonnes: number, mrn: string) {
    setBusy(true);
    setError(null);
    try {
      const tx = await act("operator", "allocate", [statementId, actors[recipient].address, BigInt(Math.round(tonnes * 1000)), shipmentRef(mrn)]);
      if (tx.status === "success") {
        setState((st) => ({ shipments: [...st.shipments, { allocationId: tx.result as Hex, recipient, tonnes, mrn }] }));
      } else setError(describe(tx).detail);
    } finally {
      setBusy(false);
    }
  }

  const used = new Set(s.shipments.map((x) => x.mrn));
  const pct = info ? (info.allocated / info.quantity) * 100 : 0;

  return (
    <div className="space-y-6">
      <StepIntro
        role="mill"
        who="Marmara Demo Steel · shipping"
        lead={
          <>
            Each shipment takes tonnes from the verified statement and gets <span className="text-mill">its own passport</span>.
          </>
        }
        more={
          <p>
            A passport carries the verifier&apos;s signature, the ledger entry, and the shared report fields with their proofs. One customs
            reference (MRN) can carry only one allocation, and the sum can never pass what was verified.
          </p>
        }
      />

      {info && (
        <section className="card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold">Verified Q3 2026 coil</span>
            <span className="num text-ink-2">
              <b className="text-mill">{info.allocated.toLocaleString("en-US")} t</b> allocated · {(info.quantity - info.allocated).toLocaleString("en-US")} t of{" "}
              {info.quantity.toLocaleString("en-US")} t left
            </span>
          </div>
          <div className="mt-2 h-3.5 overflow-hidden rounded-full bg-paper-2" role="img" aria-label={`${pct.toFixed(1)} percent allocated`}>
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--mill)] to-[#f59e0b]" style={{ width: `${Math.max(pct, 0.8)}%` }} />
          </div>
        </section>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {PRESETS.map((p) => {
          const done = used.has(p.mrn);
          return (
            <div key={p.mrn} className={`card flex items-center justify-between gap-3 p-4 ${done ? "opacity-80" : ""}`}>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-3xl" aria-hidden="true">
                  {p.flag}
                </span>
                <div>
                  <p className="font-semibold">
                    <span className="num text-mill">{p.tonnes.toLocaleString("en-US")} t</span> to {actors[p.recipient].name}
                  </p>
                  <p className="text-xs text-muted">
                    {p.city} · MRN <span className="font-mono">{p.mrn}</span>
                  </p>
                </div>
              </div>
              <Button onClick={() => allocate(p.recipient, p.tonnes, p.mrn)} disabled={busy || done} tone={done ? "done" : "mill"}>
                <Icon name={done ? "check" : "ship"} /> {done ? "Allocated" : "Allocate"}
              </Button>
            </div>
          );
        })}
      </div>

      <More label="Allocate a custom shipment">
        <form
          className="flex flex-wrap items-end gap-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const t = Math.round(Number(form.tonnes) * 1000) / 1000;
            if (t > 0 && form.mrn) allocate(form.recipient, t, form.mrn);
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Buyer</span>
            <select className="rounded-lg border border-line-strong bg-card px-2 py-1.5" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value as Role })}>
              <option value="importer">{actors.importer.name}</option>
              <option value="importer2">{actors.importer2.name}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Tonnes</span>
            <input className="num w-28 rounded-lg border border-line-strong bg-card px-2 py-1.5" inputMode="decimal" value={form.tonnes} onChange={(e) => setForm({ ...form, tonnes: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Customs reference (MRN)</span>
            <input className="w-56 rounded-lg border border-line-strong bg-card px-2 py-1.5 font-mono" value={form.mrn} onChange={(e) => setForm({ ...form, mrn: e.target.value })} />
          </label>
          <Button tone="secondary" disabled={busy}>
            Allocate
          </Button>
        </form>
      </More>
      {error && <Callout tone="danger" title={error} />}

      {s.shipments.length > 0 && info && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
            <Icon name="shieldCheck" className="h-4 w-4 text-importer" /> Passports issued
          </h3>
          <ul className="grid gap-3 md:grid-cols-2">
            {s.shipments.map((sh) => {
              const p = passportFor(s, info.chain, sh);
              return (
                <li key={sh.allocationId} className="card overflow-hidden text-sm">
                  <div className="h-1.5 bg-gradient-to-r from-[var(--mill)] via-[var(--verifier)] to-[var(--importer)]" />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{actors[sh.recipient].name}</p>
                        <p className="num text-xs text-muted">
                          {sh.tonnes.toLocaleString("en-US")} t · MRN <span className="font-mono">{sh.mrn}</span>
                        </p>
                      </div>
                      {sh.declaredAs ? <Badge tone="verified">declared</Badge> : <Badge tone="chain">open</Badge>}
                    </div>
                    <p className="mt-2 text-xs text-ink-2">
                      allocation <Hash value={sh.allocationId} />
                    </p>
                    {p && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a href={`/verify#p=${encodePassport(p)}`} className="inline-flex items-center gap-1.5 rounded-lg bg-importer-soft px-2.5 py-1.5 text-xs font-semibold text-importer hover:brightness-95">
                          <Icon name="shieldCheck" className="h-3.5 w-3.5" /> Open passport
                        </a>
                        <button type="button" onClick={() => download(p)} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-medium hover:bg-paper-2">
                          <Icon name="doc" className="h-3.5 w-3.5" /> Download JSON
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <CheatHeader />
        <div className="grid gap-3 md:grid-cols-2">
          <Cheat
            label="Sell 170,000 t of the same coil as green steel"
            explain="More than is left in the verified statement."
            run={async () => {
              await getWorld();
              return act("operator", "allocate", [statementId, actors.importer2.address, 170_000_000n, shipmentRef("26TR341000EX009999")]);
            }}
          />
          <Cheat
            label="Reuse a customs reference"
            explain={`Put 100 t more on ${s.shipments[0]?.mrn ?? "the first shipment's MRN"}.`}
            disabled={!s.shipments.length}
            run={() => act("operator", "allocate", [statementId, actors.importer2.address, 100_000n, shipmentRef(s.shipments[0].mrn)])}
          />
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!s.shipments.length} tone="importer">
          Switch to the importer <Icon name="arrow" />
        </Button>
      </div>
    </div>
  );
}
