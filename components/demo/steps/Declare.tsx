"use client";

import { useState } from "react";
import { actors, type Role } from "@/lib/chain/actors";
import { compareWithDefault } from "@/lib/cbam/cost";
import { latestPrice } from "@/lib/cbam/rules";
import { setState, useDemo } from "@/lib/demo/store";
import { act, declarationRef, reasonHash } from "@/lib/demo/world";
import { describe } from "@/lib/demo/explain";
import { checkPassport } from "@/lib/passport";
import { installation } from "@/lib/samples/marmara";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Cheat } from "../Cheat";
import { useLedgerRead } from "../hooks";
import { CostBars, YEAR } from "./Calculate";
import { passportFor } from "./Allocate";

export function Declare() {
  const s = useDemo();
  const [who, setWho] = useState<Role>("importer");
  const [error, setError] = useState<string | null>(null);
  const mine = s.shipments.filter((x) => x.recipient === who);

  const checked = useLedgerRead(
    async (chain) =>
      Promise.all(
        mine.map(async (sh) => {
          const p = passportFor(s, chain, sh);
          return { sh, p, result: p ? await checkPassport(p, chain) : null };
        }),
      ),
    [who, s.shipments, s.signed],
  );

  const sefaKg = Number(s.signed?.reportFields.sefaKgPerTonne2026 ?? 0);
  const see = (s.signed?.attestation.directKgPerTonne ?? 0) / 1000;

  async function declare(allocationId: `0x${string}`, ref: string) {
    setError(null);
    const tx = await act(who, "declare", [allocationId, declarationRef(ref)]);
    if (tx.status === "success") setState((st) => ({ shipments: st.shipments.map((x) => (x.allocationId === allocationId ? { ...x, declaredAs: ref } : x)) }));
    else setError(describe(tx).detail);
  }

  if (!s.shipments.length) return <p className="text-sm text-muted">Allocate a shipment first.</p>;
  const first = mine[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-2">
          The importer checks each passport against the ledger, without trusting the mill or anyone&apos;s spreadsheet, then surrenders it in
          the annual CBAM declaration (due 30 September 2027 for 2026 imports).
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Acting as</span>
          <select className="rounded-md border border-line-strong bg-card px-2 py-1.5" value={who} onChange={(e) => setWho(e.target.value as Role)}>
            <option value="importer">{actors.importer.name}</option>
            <option value="importer2">{actors.importer2.name}</option>
          </select>
        </label>
      </div>

      {mine.length === 0 && <p className="text-sm text-muted">{actors[who].name} has no shipments yet.</p>}

      {checked?.map(({ sh, result }) => {
        const cmp = compareWithDefault({ tonnes: sh.tonnes, see, sefaActual: sefaKg / 1000, cnCode: installation.good.cnCode, year: YEAR, priceEur: latestPrice.eur });
        const allOk = result?.checks.every((c) => c.ok);
        return (
          <section key={sh.allocationId} className="space-y-4 rounded-lg border border-line bg-card p-4">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-sm font-semibold">
                {sh.tonnes.toLocaleString("en-US")} t of hot-rolled coil · MRN <span className="font-mono">{sh.mrn}</span>
              </h3>
              {result?.status === "declared" ? <Badge tone="verified">declared as {sh.declaredAs}</Badge> : allOk ? <Badge tone="chain">passport valid</Badge> : <Badge tone="refused">passport fails</Badge>}
            </header>
            <ul className="grid gap-1.5 text-sm md:grid-cols-2">
              {result?.checks.map((c) => (
                <li key={c.title} className="flex items-start gap-2">
                  <Icon name={c.ok ? "check" : "cross"} className={`mt-0.5 h-4 w-4 shrink-0 ${c.ok ? "text-verified" : "text-refused"}`} />
                  <span>
                    {c.title}
                    <span className="block text-xs text-muted">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="rounded-md bg-paper-2 p-3">
              <CostBars fallback={cmp.fallback.eur / 1000} actual={cmp.actual.eur / 1000} unit="k€" />
              <p className="mt-2 text-xs text-ink-2">
                {Math.round(cmp.actual.certificates).toLocaleString("en-US")} certificates with the passport instead of{" "}
                {Math.round(cmp.fallback.certificates).toLocaleString("en-US")} on the default
                value: <b className="num">€{Math.round(cmp.savingEur).toLocaleString("en-US")}</b> less for this one shipment, at €{latestPrice.eur} per
                certificate.
              </p>
            </div>
            <Button onClick={() => declare(sh.allocationId, `${who === "importer" ? "DE" : "IT"}-CBAM-2026-${sh.mrn.slice(-4)}`)} disabled={result?.status !== "open" || !allOk}>
              <Icon name="check" /> {result?.status === "declared" ? "Declared" : "Surrender in the 2026 CBAM declaration"}
            </Button>
          </section>
        );
      })}
      {error && <p className="rounded-md bg-refused-soft px-3 py-2 text-sm text-refused">{error}</p>}

      <section className="space-y-2">
        <h3 className="font-display text-sm font-semibold">Try to cheat</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Cheat
            label="Declare the same allocation in a second declaration"
            explain="Count the same verified tonnes twice at the border."
            disabled={!first?.declaredAs}
            run={() => act(who, "declare", [first!.allocationId, declarationRef(`${first!.declaredAs}-AGAIN`)])}
          />
          <Cheat
            label="Declare another importer's allocation"
            explain="Use a passport that was issued to someone else."
            disabled={!s.shipments.some((x) => x.recipient !== who)}
            run={() => {
              const other = s.shipments.find((x) => x.recipient !== who)!;
              return act(who, "declare", [other.allocationId, declarationRef("BORROWED-PASSPORT")]);
            }}
          />
        </div>
      </section>

      <section className="space-y-2 rounded-lg border border-line bg-card p-4">
        <h3 className="font-display text-sm font-semibold">If the verifier finds a problem later</h3>
        <p className="text-sm text-ink-2">
          A verifier or the accreditation registry can withdraw a statement. Every passport that points at it fails at once, everywhere,
          and its remaining tonnes can no longer be allocated or declared.
        </p>
        <Cheat
          label="Withdraw the statement: the gas meter's calibration had expired"
          explain="Run as the verifier. Then re-open a passport to watch it fail."
          disabled={!s.signed?.statementId}
          run={() => act("verifier", "revokeStatement", [s.signed!.statementId!, reasonHash("Gas meter calibration expired before Q3 2026")])}
          successText="Withdrawn. The passports above now fail the “Not revoked” check."
        />
      </section>
    </div>
  );
}
