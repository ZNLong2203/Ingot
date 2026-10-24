import type { Metadata } from "next";
import { LedgerView } from "@/components/ledger/LedgerView";
import { TestnetCard } from "@/components/ledger/TestnetCard";

export const metadata: Metadata = {
  title: "Ledger",
  description: "Every verified statement, how its tonnes were split between buyers, and where each allocation ended: declared at the border or consumed downstream.",
};

export default function LedgerPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">Public view</p>
      <h1 className="font-display text-3xl font-bold tracking-tight">Ledger</h1>
      <p className="mt-2 max-w-3xl text-ink-2">
        What anyone can see: each verified statement, how its tonnes were split, and where each allocation ended. Process data, invoices and
        meter readings never appear here, only their committed root.
      </p>
      <div className="mt-8">
        <TestnetCard />
        <LedgerView />
      </div>
    </main>
  );
}
