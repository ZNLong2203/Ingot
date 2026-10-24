"use client";

import { useMemo, useState } from "react";
import { keccak256, toHex, type Hex } from "viem";
import { actors } from "@/lib/chain/actors";
import { sefaActualCoil } from "@/lib/cbam/cost";
import type { CheckStatus } from "@/lib/cbam/checks";
import { DEFAULT_DISCLOSURES, commit, prepareAttestation, reportFields } from "@/lib/demo/flow";
import { setState, useDemo } from "@/lib/demo/store";
import { act, getWorld, sign } from "@/lib/demo/world";
import { describe } from "@/lib/demo/explain";
import { installation } from "@/lib/samples/marmara";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Hash } from "@/components/ui/Hash";
import { Icon } from "@/components/ui/Icon";
import { Cheat } from "../Cheat";
import { useDerived } from "../hooks";
import { YEAR } from "./Calculate";

const mark: Record<CheckStatus, { icon: "check" | "warn" | "cross"; cls: string; label: string }> = {
  pass: { icon: "check", cls: "text-verified", label: "pass" },
  warn: { icon: "warn", cls: "text-warn", label: "look" },
  fail: { icon: "cross", cls: "text-refused", label: "fail" },
};

export function Verify({ onNext }: { onNext: () => void }) {
  const s = useDemo();
  const { result, checks, precursors } = useDerived();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const seed = useMemo<Hex>(() => s.signed?.reportSeed ?? keccak256(toHex(`marmara-q3-report-${installation.key}`)), [s.signed]);
  const fields = useMemo(() => {
    if (!result) return null;
    if (s.signed) return s.signed.reportFields;
    const sefa = sefaActualCoil({ year: YEAR, crudeSteelT: result.crudeSteelT, hotRolledT: result.hotRolledT, pigIronT: result.pigIronT });
    return reportFields(result, { sefaKgPerTonne2026: Math.round(sefa.sefa * 1000) });
  }, [result, s.signed]);
  const report = useMemo(() => (fields ? commit(fields, seed) : null), [fields, seed]);

  if (!result || !report || !fields) return <p className="text-sm text-muted">Calculate first.</p>;
  const blocking = checks.filter((c) => c.status === "fail");
  const signed = s.signed;
  const recorded = Boolean(signed?.statementId);

  async function signIt() {
    setBusy("sign");
    setError(null);
    try {
      const chain = await getWorld();
      const a = prepareAttestation({ chain, result: result!, precursors, report: report! });
      const signature = await sign(chain, "verifier", a);
      setState({ signed: { attestation: a, signature, reportSeed: seed, reportFields: fields!, precursors } });
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (!signed) return;
    setBusy("submit");
    setError(null);
    try {
      const tx = await act("operator", "submitStatement", [signed.attestation, signed.signature, signed.precursors.map((p) => p.allocationId)]);
      if (tx.status === "success") setState({ signed: { ...signed, statementId: tx.result as Hex } });
      else setError(describe(tx).detail);
    } finally {
      setBusy(null);
    }
  }

  /** The verifier, bribed, signs a coil far cleaner than its own pig iron. */
  async function launder() {
    const chain = await getWorld();
    const a = prepareAttestation({ chain, result: result!, precursors, report: report! });
    const bent = { ...a, directKgPerTonne: 150 };
    return act("operator", "submitStatement", [bent, await sign(chain, "verifier", bent), precursors.map((p) => p.allocationId)]);
  }

  async function tamper() {
    const bent = { ...signed!.attestation, directKgPerTonne: 250 };
    return act("operator", "submitStatement", [bent, signed!.signature, signed!.precursors.map((p) => p.allocationId)]);
  }

  async function secondStatement() {
    const chain = await getWorld();
    const a = { ...signed!.attestation, deadline: chain.now + 86_400, evidenceRoot: keccak256(toHex("a second report for the same coil")) };
    return act("operator", "submitStatement", [a, await sign(chain, "verifier", a), signed!.precursors.map((p) => p.allocationId)]);
  }

  async function reusePigIron() {
    const chain = await getWorld();
    // Another product, so the period check passes and the precursor check is what answers.
    const a = { ...signed!.attestation, cnCode: 72085400, deadline: chain.now + 86_400 };
    return act("operator", "submitStatement", [a, await sign(chain, "verifier", a), signed!.precursors.map((p) => p.allocationId)]);
  }

  const groups = ["Evidence", "Physics", "Ledger"] as const;

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-ink-2">
        {actors.verifier.name} reviews the report before signing. The checks below point at what deserves a second look; they do not
        replace the site visit the rules require. Under CBAM a misstatement is material above 5 % of the specific embedded emissions.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        {groups.map((g) => (
          <section key={g} className="rounded-lg border border-line bg-card">
            <h3 className="border-b border-line px-4 py-2.5 font-display text-sm font-semibold">{g}</h3>
            <ul className="divide-y divide-line">
              {checks
                .filter((c) => c.group === g)
                .map((c) => (
                  <li key={c.id} className="px-4 py-2.5 text-sm">
                    <p className="flex items-start gap-2 font-medium">
                      <Icon name={mark[c.status].icon} className={`mt-0.5 h-4 w-4 shrink-0 ${mark[c.status].cls}`} />
                      <span>
                        {c.title}
                        <span className="sr-only"> ({mark[c.status].label})</span>
                      </span>
                    </p>
                    {c.value && <p className="num ml-6 text-xs text-ink">{c.value}</p>}
                    <p className="ml-6 text-xs text-muted">{c.detail}</p>
                    {c.range && <p className="ml-6 text-[11px] text-muted">Source: {c.range.source}</p>}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="rounded-lg border border-line bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-sm font-semibold">What goes on the ledger, and what stays private</h3>
          <span className="text-xs text-muted">
            evidence root <Hash value={report.root} />
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">
          Each report field becomes a salted leaf of a Merkle tree. Only the root is signed and stored. Importers receive the fields marked
          shared, each with a proof the contract can check; the rest never leaves the mill unless a customs officer asks.
        </p>
        <ul className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(fields).map(([k, v]) => (
            <li key={k} className="flex items-center justify-between gap-2 rounded-md bg-paper-2 px-2.5 py-1.5">
              <span className="text-ink-2">{k}</span>
              <span className="num flex items-center gap-1.5 font-medium">
                {String(v)}
                {DEFAULT_DISCLOSURES.includes(k) ? <Badge tone="chain">shared</Badge> : <Badge>private</Badge>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-lg border border-line bg-card p-4">
        <h3 className="font-display text-sm font-semibold">Sign, then record</h3>
        {blocking.length > 0 && <p className="text-sm text-refused">Resolve the failed checks before signing.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={signIt} disabled={Boolean(busy) || blocking.length > 0 || Boolean(signed)} tone={signed ? "secondary" : "primary"}>
            <Icon name="sign" /> {signed ? `Signed by ${actors.verifier.name}` : `Sign as ${actors.verifier.name} (EIP-712)`}
          </Button>
          <Button onClick={submit} disabled={!signed || recorded || Boolean(busy)} tone={recorded ? "secondary" : "primary"}>
            <Icon name="chain" /> {recorded ? "Recorded on the ledger" : busy === "submit" ? "Recording…" : `Record as ${actors.operator.name}`}
          </Button>
        </div>
        {signed && (
          <details className="text-xs">
            <summary className="cursor-pointer text-ink-2">Signed typed data</summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-paper-2 p-3 font-mono text-[11px] leading-relaxed">
              {JSON.stringify(signed.attestation, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2)}
              {"\n\nsignature: "}
              {signed.signature}
            </pre>
          </details>
        )}
        {recorded && (
          <p className="flex flex-wrap items-center gap-2 rounded-md bg-verified-soft px-3 py-2 text-sm text-verified">
            <Icon name="check" /> Statement <Hash value={signed!.statementId!} /> recorded. The pig iron allocation is now consumed: its{" "}
            {result.precursorDirectT.toLocaleString("en-US", { maximumFractionDigits: 0 })} t CO2e travel inside this coil.
          </p>
        )}
        {error && <p className="text-sm text-refused">{error}</p>}
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-sm font-semibold">Try to cheat</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {!recorded ? (
            <>
              <Cheat
                label="Bribe the verifier to sign 0.150 t CO2e/t"
                explain="A valid signature on a coil cleaner than the pig iron inside it."
                run={launder}
                disabled={!precursors.length}
              />
              <Cheat
                label="Edit the number after the verifier signed"
                explain="Submit 0.250 t CO2e/t with the signature made for the real value."
                run={tamper}
                disabled={!signed}
              />
            </>
          ) : (
            <>
              <Cheat label="Verify the same quarter's coil again" explain="A second signed statement for the same product and period." run={secondStatement} />
              <Cheat label="Use the same pig iron in another product" explain="Claim the 18,000 t a second time, for hot-rolled sheet." run={reusePigIron} />
            </>
          )}
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!recorded}>
          Ship to EU buyers <Icon name="arrow" />
        </Button>
      </div>
    </div>
  );
}
