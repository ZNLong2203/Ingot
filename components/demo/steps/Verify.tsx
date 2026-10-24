"use client";

import { useMemo, useState } from "react";
import { bytesToHex, hashTypedData, keccak256, toHex, type Hex } from "viem";
import { attestationTypes, registryDomain } from "@/lib/chain/eip712";
import { demoPqKeys, pqSign, toBase64 } from "@/lib/crypto/pq";
import { actors } from "@/lib/chain/actors";
import { sefaActualCoil } from "@/lib/cbam/cost";
import type { CheckStatus } from "@/lib/cbam/checks";
import { DEFAULT_DISCLOSURES, commit, prepareAttestation, reportFields } from "@/lib/demo/flow";
import { setState, useDemo } from "@/lib/demo/store";
import { act, getWorld, sign } from "@/lib/demo/world";
import { describe } from "@/lib/demo/explain";
import { Button } from "@/components/ui/Button";
import { Hash } from "@/components/ui/Hash";
import { Icon } from "@/components/ui/Icon";
import { Callout } from "@/components/ui/Kit";
import { Cheat, CheatHeader } from "../Cheat";
import { StepIntro } from "../StepIntro";
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

  // The salt seed is the mill's secret: random, kept with the signed statement, never on chain.
  const [freshSeed] = useState<Hex>(() => bytesToHex(crypto.getRandomValues(new Uint8Array(32))));
  const seed = s.signed?.reportSeed ?? freshSeed;
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
      const digest = hashTypedData({ domain: registryDomain(chain.chainId, chain.registry), types: attestationTypes, primaryType: "Attestation", message: a });
      const pq = toBase64(pqSign(digest, demoPqKeys("verifier").secretKey));
      setState({ signed: { attestation: a, signature, reportSeed: seed, reportFields: fields!, precursors, pq } });
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

  const passed = checks.filter((c) => c.status === "pass").length;

  return (
    <div className="space-y-6">
      <StepIntro
        role="verifier"
        who={`${actors.verifier.name} · accredited verifier`}
        lead={
          <>
            Checks first, then <span className="text-verifier">one signature</span>. Only a fingerprint of the report goes on chain.
          </>
        }
        more={
          <p>
            The checks compare the mill&apos;s numbers with ranges from the EU Best Available Techniques reference documents. They point at what
            deserves a second look and do not replace the site visit the rules require. Under CBAM a misstatement is material above 5 % of the
            specific embedded emissions.
          </p>
        }
      />

      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-sm font-semibold">Plausibility checks</h3>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${blocking.length ? "bg-refused-soft text-refused" : "bg-verified-soft text-verified"}`}>
            {passed} of {checks.length} pass
          </span>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((c) => (
            <li
              key={c.id}
              title={c.range ? `${c.detail} Source: ${c.range.source}` : c.detail}
              className={`rounded-xl border px-3 py-2.5 text-sm ${
                c.status === "pass" ? "border-verified/25 bg-verified-soft/50" : c.status === "warn" ? "border-warn/30 bg-warn-soft" : "border-refused/30 bg-refused-soft"
              }`}
            >
              <p className="flex items-start gap-2 font-medium">
                <Icon name={mark[c.status].icon} className={`mt-0.5 h-4 w-4 shrink-0 ${mark[c.status].cls}`} />
                <span>
                  {c.title}
                  <span className="sr-only"> ({mark[c.status].label})</span>
                </span>
              </p>
              <p className="num ml-6 text-xs text-ink-2">{c.value ?? c.detail}</p>
              {c.status !== "pass" && c.value && <p className="ml-6 mt-1 text-xs text-ink-2">{c.detail}</p>}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">Hover a check for its source range.</p>
      </section>

      <section className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-sm font-semibold">What importers see, and what stays with the mill</h3>
          <span className="text-xs text-muted">
            evidence root <Hash value={report.root} />
          </span>
        </div>
        <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {Object.entries(fields).map(([k, v]) => {
            const shared = DEFAULT_DISCLOSURES.includes(k);
            return (
              <li
                key={k}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${shared ? "bg-chain-soft text-chain" : "bg-paper-2 text-muted"}`}
              >
                <Icon name={shared ? "eye" : "lock"} className="h-3.5 w-3.5" />
                <span>{k}</span>
                <b className={`num ${shared ? "" : "blur-[3px]"}`}>{String(v)}</b>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted">Each field is a salted leaf of a Merkle tree; shared fields travel with proofs the contract can check.</p>
      </section>

      <section className="card space-y-3 border-verifier/30 p-4">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Icon name="stamp" className="h-4 w-4 text-verifier" /> Sign, then record
        </h3>
        {blocking.length > 0 && <Callout tone="danger" title="Resolve the failed checks before signing" />}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={signIt} disabled={Boolean(busy) || blocking.length > 0 || Boolean(signed)} tone={signed ? "done" : "verifier"}>
            <Icon name={signed ? "check" : "sign"} /> {signed ? `Signed by ${actors.verifier.name}` : `Sign as ${actors.verifier.name}`}
          </Button>
          <Icon name="arrow" className="h-4 w-4 text-muted" />
          <Button onClick={submit} disabled={!signed || recorded || Boolean(busy)} tone={recorded ? "done" : "mill"}>
            <Icon name={recorded ? "check" : "chain"} /> {recorded ? "Recorded on the ledger" : busy === "submit" ? "Recording…" : `Record as ${actors.operator.name}`}
          </Button>
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          Hybrid signature:
          <span className={`rounded-full px-2 py-0.5 font-medium ${signed ? "bg-verifier-soft text-verifier" : "bg-paper-2"}`}>ECDSA · EIP-712</span>
          <span className={`rounded-full px-2 py-0.5 font-medium ${signed?.pq ? "bg-verifier-soft text-verifier" : "bg-paper-2"}`}>ML-DSA-65 · FIPS 204, post-quantum</span>
          <span>the second key&apos;s hash is registered on chain</span>
        </p>
        {signed && (
          <details className="text-xs">
            <summary className="cursor-pointer text-ink-2 hover:text-ink">Show the signed typed data</summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-paper-2 p-3 font-mono text-[11px] leading-relaxed">
              {JSON.stringify(signed.attestation, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2)}
              {"\n\nsignature: "}
              {signed.signature}
            </pre>
          </details>
        )}
        {recorded && (
          <Callout tone="success" title="Statement recorded on the ledger">
            <span className="inline-flex flex-wrap items-center gap-1">
              <Hash value={signed!.statementId!} /> The pig iron allocation is consumed: its{" "}
              <b>{result.precursorDirectT.toLocaleString("en-US", { maximumFractionDigits: 0 })} t CO2e</b> now travel inside this coil.
            </span>
          </Callout>
        )}
        {error && <Callout tone="danger" title={error} />}
      </section>

      <section className="space-y-2">
        <CheatHeader />
        <div className="grid gap-3 md:grid-cols-2">
          {!recorded ? (
            <>
              <Cheat
                label="Bribe the verifier to sign 0.150 t CO2e/t"
                explain="A valid signature on a coil cleaner than the pig iron inside it."
                run={launder}
                disabled={!precursors.length}
              />
              <Cheat label="Edit the number after the verifier signed" explain="Submit 0.250 with the signature made for the real value." run={tamper} disabled={!signed} />
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
        <Button onClick={onNext} disabled={!recorded} tone="mill">
          Ship to EU buyers <Icon name="arrow" />
        </Button>
      </div>
    </div>
  );
}
