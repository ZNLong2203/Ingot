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
  return (
    <div className="rounded-lg border border-dashed border-refused/40 bg-card p-3">
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
        className="flex w-full items-start gap-2 text-left text-sm font-medium text-refused hover:underline disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon name="warn" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {busy ? "Trying…" : label}
          <span className="mt-0.5 block text-xs font-normal text-muted">{explain}</span>
        </span>
      </button>
      {tx && (
        <p className={`mt-2 rounded-md px-2.5 py-2 text-xs ${tx.status === "reverted" ? "bg-refused-soft text-refused" : "bg-warn-soft text-warn"}`} role="status">
          {tx.status === "reverted" ? (
            <>
              <b>Refused by the contract · {tx.error?.name}.</b> {refusal(tx.error!.name, tx.error!.args)}
            </>
          ) : (
            <>{successText}</>
          )}
        </p>
      )}
    </div>
  );
}
