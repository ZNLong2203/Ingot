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
import { installation } from "@/lib/samples/marmara";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Hash } from "@/components/ui/Hash";
import { Icon } from "@/components/ui/Icon";
import { Cheat } from "../Cheat";
import { useLedgerRead } from "../hooks";

export const PRESETS: { recipient: Role; tonnes: number; mrn: string; city: string }[] = [
  { recipient: "importer", tonnes: 6_000, mrn: "26TR341000EX000101", city: "Duisburg" },
  { recipient: "importer2", tonnes: 4_500, mrn: "26TR341000EX000102", city: "Brescia" },
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
      <p className="max-w-3xl text-sm text-ink-2">
        Each shipment to an EU buyer takes its tonnes from the verified statement and gets its own passport: the verifier&apos;s signature,
        the ledger entry, and the shared report fields with their proofs. The customs reference (MRN) can carry only one allocation.
      </p>

      {info && (
        <section className="rounded-lg border border-line bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">Verified Q3 2026 coil</span>
            <span className="num text-ink-2">
              {info.allocated.toLocaleString("en-US")} of {info.quantity.toLocaleString("en-US")} t allocated ·{" "}
              {(info.quantity - info.allocated).toLocaleString("en-US")} t left
            </span>
          </div>
          <div className="mt-2 h-3 rounded-full bg-paper-2" role="img" aria-label={`${pct.toFixed(1)} percent allocated`}>
            <div className="h-3 rounded-full bg-ink" style={{ width: `${Math.max(pct, 0.6)}%` }} />
          </div>
        </section>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {PRESETS.map((p) => (
          <div key={p.mrn} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card p-4">
            <div className="text-sm">
              <p className="font-medium">
                {p.tonnes.toLocaleString("en-US")} t to {actors[p.recipient].name}
              </p>
              <p className="text-xs text-muted">
                {p.city} · MRN <span className="font-mono">{p.mrn}</span>
              </p>
            </div>
            <Button onClick={() => allocate(p.recipient, p.tonnes, p.mrn)} disabled={busy || used.has(p.mrn)} tone={used.has(p.mrn) ? "secondary" : "primary"}>
              <Icon name="ship" /> {used.has(p.mrn) ? "Allocated" : "Allocate"}
            </Button>
          </div>
        ))}
      </div>

      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-card p-4 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const t = Number(form.tonnes);
          if (t > 0 && form.mrn) allocate(form.recipient, t, form.mrn);
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Buyer</span>
          <select className="rounded-md border border-line-strong bg-card px-2 py-1.5" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value as Role })}>
            <option value="importer">{actors.importer.name}</option>
            <option value="importer2">{actors.importer2.name}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Tonnes</span>
          <input className="num w-28 rounded-md border border-line-strong bg-card px-2 py-1.5" inputMode="decimal" value={form.tonnes} onChange={(e) => setForm({ ...form, tonnes: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Customs reference (MRN)</span>
          <input className="w-56 rounded-md border border-line-strong bg-card px-2 py-1.5 font-mono" value={form.mrn} onChange={(e) => setForm({ ...form, mrn: e.target.value })} />
        </label>
        <Button tone="secondary" disabled={busy}>
          Allocate
        </Button>
      </form>
      {error && <p className="rounded-md bg-refused-soft px-3 py-2 text-sm text-refused">{error}</p>}

      {s.shipments.length > 0 && info && (
        <section className="space-y-2">
          <h3 className="font-display text-sm font-semibold">Passports issued</h3>
          <ul className="grid gap-3 md:grid-cols-2">
            {s.shipments.map((sh) => {
              const p = passportFor(s, info.chain, sh);
              return (
                <li key={sh.allocationId} className="rounded-lg border border-line bg-card p-4 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{actors[sh.recipient].name}</p>
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
                      <a href={`/verify#p=${encodePassport(p)}`} className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-2.5 py-1.5 text-xs font-medium hover:bg-paper-2">
                        <Icon name="shield" className="h-3.5 w-3.5" /> Open passport
                      </a>
                      <button type="button" onClick={() => download(p)} className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-2.5 py-1.5 text-xs font-medium hover:bg-paper-2">
                        <Icon name="doc" className="h-3.5 w-3.5" /> Download JSON
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="font-display text-sm font-semibold">Try to cheat</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Cheat
            label="Sell 170,000 t of the same coil as green steel to a third buyer"
            explain="More than is left in the verified statement."
            run={async () => {
              await getWorld();
              return act("operator", "allocate", [statementId, actors.importer2.address, 170_000_000n, shipmentRef("26TR341000EX009999")]);
            }}
          />
          <Cheat
            label="Put a second allocation on an MRN already used"
            explain={`Reuse ${s.shipments[0]?.mrn ?? "the first shipment's MRN"} for 100 t to another buyer.`}
            disabled={!s.shipments.length}
            run={() => act("operator", "allocate", [statementId, actors.importer2.address, 100_000n, shipmentRef(s.shipments[0].mrn)])}
          />
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!s.shipments.length}>
          Switch to the importer <Icon name="arrow" />
        </Button>
      </div>
    </div>
  );
}
