"use client";

import { actorByAddress } from "@/lib/chain/actors";
import { describe } from "@/lib/demo/explain";
import { Badge } from "@/components/ui/Badge";
import { Hash } from "@/components/ui/Hash";
import { Icon } from "@/components/ui/Icon";
import { roleOf, roleStyle } from "@/components/ui/roles";
import { useChain, useLedgerVersion } from "./hooks";

const time = (s: number) =>
  new Date(s * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

/** Every transaction the sandbox has run, newest first, refusals included. */
export function LedgerPanel() {
  const chain = useChain();
  useLedgerVersion();
  const txs = chain ? [...chain.txs].reverse() : [];
  return (
    <section aria-labelledby="ledger-title" className="card overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-line bg-chain-soft/60 px-4 py-3">
        <h2 id="ledger-title" className="flex items-center gap-2 font-display text-sm font-semibold">
          <Icon name="chain" className="h-4 w-4 text-chain" /> Ledger
        </h2>
        {chain ? (
          <span className="text-xs text-muted">
            EVM sandbox · registry <Hash value={chain.registry} />
          </span>
        ) : (
          <span className="text-xs text-muted">starting…</span>
        )}
      </header>
      <ol className="max-h-[70vh] divide-y divide-line overflow-y-auto" aria-live="polite">
        {txs.map((tx) => {
          const d = describe(tx);
          const ok = tx.status === "success";
          const actor = actorByAddress(tx.from);
          const r = roleStyle[roleOf(actor?.role ?? "")];
          return (
            <li key={tx.hash} className={`border-l-[3px] px-4 py-3 text-sm ${ok ? "border-l-verified/70" : "border-l-refused bg-refused-soft/60"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-1.5 font-semibold">
                  {ok ? <Icon name="check" className="h-3.5 w-3.5 text-verified" /> : <Icon name="cross" className="h-3.5 w-3.5 text-refused" />}
                  {d.title}
                </p>
                <span className="num shrink-0 text-xs text-muted">
                  #{tx.block} · {time(tx.timestamp)}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs">
                <span className={`inline-flex h-4 w-4 items-center justify-center rounded ${r.soft} ${r.text}`}>
                  <Icon name={r.icon} className="h-3 w-3" />
                </span>
                <span className={`font-medium ${r.text}`}>{actor?.name ?? tx.from}</span>
              </p>
              {d.detail && <p className={`mt-1 text-xs ${ok ? "text-ink-2" : "font-medium text-refused"}`}>{d.detail}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                {ok ? <Badge tone="verified">mined</Badge> : <Badge tone="refused">refused · {tx.error?.name}</Badge>}
                <span className="num">{tx.gasUsed.toLocaleString("en-US")} gas</span>
                <Hash value={tx.hash} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
