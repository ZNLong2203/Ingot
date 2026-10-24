import type { Metadata } from "next";
import { PassportChecker } from "@/components/verify/PassportChecker";

export const metadata: Metadata = {
  title: "Check a passport",
  description: "Check a CBAM embedded-emissions passport against the ledger: the verifier's signature, the statement, the allocation, its precursors and the disclosed fields.",
};

export default function VerifyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">For importers, customs and auditors</p>
      <h1 className="font-display text-3xl font-bold tracking-tight">Check a passport</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        No account, no trust in the mill: the page recovers the verifier&apos;s signature, finds the statement and the allocation on the ledger,
        follows the precursors upstream, and proves each disclosed field against the signed evidence root.
      </p>
      <div className="mt-8">
        <PassportChecker />
      </div>
    </main>
  );
}
