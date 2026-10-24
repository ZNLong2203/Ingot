"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { SandboxChain } from "@/lib/chain/sandbox";
import { calculate, type Result } from "@/lib/cbam/calculate";
import { runChecks, type Check } from "@/lib/cbam/checks";
import { deliveryNoteNumbers, deriveLines } from "@/lib/demo/derive";
import { findPrecursors, type LedgerPrecursor } from "@/lib/demo/flow";
import { useDemo } from "@/lib/demo/store";
import { getVersion, getWorld, subscribe } from "@/lib/demo/world";
import { months } from "@/lib/samples/marmara";

export function useLedgerVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, () => -1);
}

export function useChain(): SandboxChain | null {
  const [chain, setChain] = useState<SandboxChain | null>(null);
  const version = useLedgerVersion();
  useEffect(() => {
    let live = true;
    getWorld().then((c) => live && setChain(c));
    return () => {
      live = false;
    };
  }, [version]);
  return chain;
}

/** Re-runs an async read whenever the ledger or the inputs change. */
export function useLedgerRead<T>(read: (chain: SandboxChain) => Promise<T>, deps: unknown[]): T | undefined {
  const chain = useChain();
  const version = useLedgerVersion();
  const [value, setValue] = useState<T>();
  useEffect(() => {
    if (!chain) return;
    let live = true;
    read(chain).then((v) => live && setValue(v)).catch(() => live && setValue(undefined));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, version, ...deps]);
  return value;
}

export interface Derived {
  lines: ReturnType<typeof deriveLines>["lines"];
  duplicates: ReturnType<typeof deriveLines>["duplicates"];
  precursors: LedgerPrecursor[];
  result: Result | null;
  checks: Check[];
}

/** Everything computed from the documents read so far and the ledger. */
export function useDerived(): Derived {
  const s = useDemo();
  const { lines, duplicates } = useMemo(() => deriveLines(s), [s]);
  const notes = useMemo(() => deliveryNoteNumbers(s), [s]);
  const live = useLedgerRead((c) => findPrecursors(c, notes), [notes.join()]);
  // Once the statement is recorded its precursors are consumed; keep the ones it used.
  const precursors = useMemo<LedgerPrecursor[]>(
    () => (s.signed?.statementId ? s.signed.precursors : (live ?? [])),
    [s.signed, live],
  );
  const result = useMemo(() => (lines.some((l) => !l.excluded) ? calculate(lines, precursors) : null), [lines, precursors]);
  const checks = useMemo(
    () =>
      result
        ? runChecks({
            lines,
            result,
            duplicates,
            months,
            precursorMatched: precursors.length > 0 && !result.missing.some((m) => m.startsWith("pig iron")),
          })
        : [],
    [lines, result, duplicates, precursors],
  );
  return { lines, duplicates, precursors, result, checks };
}
