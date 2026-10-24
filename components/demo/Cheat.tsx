"use client";

import { useState } from "react";
import type { SandboxTx } from "@/lib/chain/sandbox";
import { refusal } from "@/lib/demo/explain";
import { Icon } from "@/components/ui/Icon";

/**
 * A button that tries something dishonest against the real contract and
 * shows what the ledger said. Nothing here is simulated: the transaction
 * runs and is refused by the registry's bytecode.
 */
export function Cheat({
  label,
  explain,
  run,
  disabled,
  successText = "The transaction went through. This is a gap worth reporting.",
}: {
  label: string;
  explain: string;
  run: () => Promise<SandboxTx>;
  disabled?: boolean;
  successText?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<SandboxTx | null>(null);
  const blocked = tx?.status === "reverted";
  return (
    <div className={`rounded-xl border p-3.5 transition ${blocked ? "border-refused/40 bg-refused-soft" : "border-dashed border-refused/35 bg-card"}`}>
      <button
        type="button"
        disabled={busy || disabled}
        onClick={async () => {
          setBusy(true);
          try {
            setTx(await run());
          } finally {
            setBusy(false);
          }
        }}
        className="flex w-full items-start gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-refused-soft text-refused">
          <Icon name={busy ? "spark" : "warn"} className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-refused group-hover:underline">{busy ? "Trying…" : label}</span>
          <span className="mt-0.5 block text-xs text-muted">{explain}</span>
        </span>
      </button>
      {tx && (
        <div className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${blocked ? "bg-refused text-white" : "bg-warn-soft text-warn"}`} role="status">
          <Icon name={blocked ? "shield" : "info"} className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {blocked ? (
              <>
                <b>Blocked by the contract · {tx.error?.name}.</b> {refusal(tx.error!.name, tx.error!.args)}
              </>
            ) : (
              successText
            )}
          </span>
        </div>
      )}
    </div>
  );
}

/** The red section header above a step's cheat buttons. */
export function CheatHeader() {
  return (
    <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-refused">
      <Icon name="shield" className="h-4 w-4" /> Try to cheat
      <span className="font-sans text-xs font-normal text-muted">real transactions, refused by the contract</span>
    </h3>
  );
}
