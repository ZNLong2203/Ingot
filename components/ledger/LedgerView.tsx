"use client";

import type { Hex } from "viem";
import { actorByAddress } from "@/lib/chain/actors";
import type { SandboxChain } from "@/lib/chain/sandbox";
import { Badge } from "@/components/ui/Badge";
import { Hash } from "@/components/ui/Hash";
import { Icon } from "@/components/ui/Icon";
import { useLedgerRead } from "@/components/demo/hooks";
import { LedgerPanel } from "@/components/demo/LedgerPanel";

const STATUS = ["", "open", "declared", "consumed"] as const;
const date = (s: number) => new Date(s * 1000).toISOString().slice(0, 10);
const t = (kg: bigint) => `${(Number(kg) / 1000).toLocaleString("en-US")} t`;

async function snapshot(chain: SandboxChain) {
  const statements = [];
  const n = await chain.read("statementCount", []);
  for (let i = 0n; i < n; i++) {
    const id = await chain.read("statementIds", [i]);
    const s = await chain.read("getStatement", [id]);
    const inst = await chain.read("installations", [s.installationId]);
    statements.push({ id, s, operator: inst[0], country: inst[1], inputs: await chain.read("getStatementInputs", [id]) });
  }
  const allocations = [];
  const m = await chain.read("allocationCount", []);
  for (let i = 0n; i < m; i++) {
    const id = await chain.read("allocationIds", [i]);
    allocations.push({ id, a: await chain.read("getAllocation", [id]) });
  }
  return { statements, allocations };
}

const country = (hex: string) => {
  const code = String.fromCharCode(parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16));
  return code === "TR" ? "Türkiye" : code === "BR" ? "Brazil" : code;
};

export function LedgerView() {
  const data = useLedgerRead(snapshot, []);
  if (!data) return <p className="text-sm text-muted">Reading the ledger…</p>;
  const byStatement = (id: Hex) => data.allocations.filter((x) => x.a.statementId === id);
  const consumedInto = (id: Hex) => data.statements.find((s) => s.id === id);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        {data.statements.map(({ id, s, operator, country: c, inputs }) => {
          const allocs = byStatement(id);
          const pct = Number((s.allocatedKg * 1000n) / s.quantityKg) / 10;
          return (
            <article key={id} className="card overflow-hidden">
              <header className={`flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 ${s.revoked ? "bg-refused-soft" : inputs.length ? "bg-mill-soft/60" : "bg-verifier-soft/50"}`}>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">
                    Statement <Hash value={id} /> · CN {s.cnCode} · {date(s.periodStart)} → {date(s.periodEnd)}
                  </p>
                  <h2 className="mt-1 font-display text-lg font-bold">
                    {actorByAddress(operator)?.name ?? operator} <span className="text-sm font-normal text-muted">({country(c)})</span>
                  </h2>
                  <p className="text-xs text-muted">Signed by {actorByAddress(s.verifier)?.name ?? s.verifier}</p>
                </div>
                <div className="text-right">
                  <p className="num font-display text-3xl font-extrabold text-verified">{(s.directKgPerTonne / 1000).toFixed(3)}</p>
                  <p className="text-xs text-muted">t CO2e/t direct</p>
                  {s.revoked ? <Badge tone="refused">withdrawn</Badge> : <Badge tone="verified">live</Badge>}
                </div>
              </header>
              <div className="space-y-3 px-5 py-4 text-sm">
                {inputs.length > 0 && (
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
                    <Icon name="chain" className="h-3.5 w-3.5 text-chain" /> Consumed precursors:
                    {inputs.map((inp) => {
                      const al = data.allocations.find((x) => x.id === inp);
                      const up = al && data.statements.find((x) => x.id === al.a.statementId);
                      return (
                        <span key={inp}>
                          {al ? t(al.a.quantityKg) : ""} from {up ? (actorByAddress(up.operator)?.name ?? "upstream") : "upstream"} (
                          <Hash value={inp} />)
                        </span>
                      );
                    })}
                    · carrying {t(s.precursorDirectKg)} CO2e
                  </p>
                )}
                <div>
                  <div className="flex justify-between text-xs text-muted">
                    <span>
                      {t(s.allocatedKg)} of {t(s.quantityKg)} allocated
                    </span>
                    <span>{pct.toFixed(1)} %</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-paper-2">
                    <div className="h-2 rounded-full bg-gradient-to-r from-[var(--mill)] to-[#f59e0b]" style={{ width: `${Math.max(pct, 0.5)}%` }} />
                  </div>
                </div>
                {allocs.length > 0 && (
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {allocs.map(({ id: aid, a }) => {
                      const into = a.status === 3 ? consumedInto(a.spentIn) : undefined;
                      return (
                        <li key={aid} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                          <span>
                            <span className="num font-medium">{t(a.quantityKg)}</span> → {actorByAddress(a.recipient)?.name ?? a.recipient}{" "}
                            <Hash value={aid} />
                          </span>
                          <span className="flex items-center gap-2">
                            {into && <span className="text-muted">into statement <Hash value={into.id} /></span>}
                            <Badge tone={a.status === 2 ? "verified" : a.status === 3 ? "chain" : "neutral"}>{STATUS[a.status]}</Badge>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <LedgerPanel />
      </aside>
    </div>
  );
}
