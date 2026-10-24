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
import { Callout } from "@/components/ui/Kit";
import { Cheat, CheatHeader } from "../Cheat";
import { StepIntro } from "../StepIntro";
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
      <StepIntro
        role="importer"
        who={`${actors[who].name} · EU importer`}
        lead={
          <>
            Check the passport against the ledger, then <span className="text-importer">surrender it once</span> in the CBAM declaration.
          </>
        }
        action={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Acting as</span>
            <select className="rounded-lg border border-line-strong bg-card px-2 py-1.5" value={who} onChange={(e) => setWho(e.target.value as Role)}>
              <option value="importer">{actors.importer.name}</option>
              <option value="importer2">{actors.importer2.name}</option>
            </select>
          </label>
        }
        more={<p>No trust in the mill or anyone&apos;s spreadsheet: signature, statement, allocation, precursors and disclosed fields are all checked against the ledger. The first annual declaration, for 2026 imports, is due on 30 September 2027.</p>}
      />

      {mine.length === 0 && <Callout tone="info" title={`${actors[who].name} has no shipments yet`} />}

      {checked?.map(({ sh, result }) => {
        const cmp = compareWithDefault({ tonnes: sh.tonnes, see, sefaActual: sefaKg / 1000, cnCode: installation.good.cnCode, year: YEAR, priceEur: latestPrice.eur });
        const allOk = result?.checks.every((c) => c.ok);
        const passed = result?.checks.filter((c) => c.ok).length ?? 0;
        return (
          <section key={sh.allocationId} className="card overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
              <h3 className="font-display text-sm font-semibold">
                <span className="num text-importer">{sh.tonnes.toLocaleString("en-US")} t</span> hot-rolled coil · MRN <span className="font-mono">{sh.mrn}</span>
              </h3>
              {result?.status === "declared" ? (
                <Badge tone="verified">declared as {sh.declaredAs}</Badge>
              ) : allOk ? (
                <Badge tone="chain">passport valid · {passed}/{result?.checks.length}</Badge>
              ) : (
                <Badge tone="refused">passport fails</Badge>
              )}
            </header>
            <div className="grid gap-0 md:grid-cols-[1.1fr_1fr]">
              <ul className="space-y-2 p-5 text-sm">
                {result?.checks.map((c) => (
                  <li key={c.title} className="flex items-start gap-2" title={c.detail}>
                    <span className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${c.ok ? "bg-verified text-white" : "bg-refused text-white"}`}>
                      <Icon name={c.ok ? "check" : "cross"} className="h-2.5 w-2.5" />
                    </span>
                    <span className={c.ok ? "" : "font-semibold text-refused"}>
                      {c.title}
                      {!c.ok && <span className="block text-xs font-normal text-ink-2">{c.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col justify-between gap-4 border-t border-line bg-importer-soft/60 p-5 md:border-l md:border-t-0">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-importer">Saved on this shipment</p>
                  <p className="num font-display text-4xl font-extrabold text-importer">€{Math.round(cmp.savingEur).toLocaleString("en-US")}</p>
                  <p className="num mt-1 text-xs text-ink-2">
                    {Math.round(cmp.actual.certificates).toLocaleString("en-US")} certificates instead of {Math.round(cmp.fallback.certificates).toLocaleString("en-US")} at €
                    {latestPrice.eur}
                  </p>
                </div>
                <CostBars fallback={cmp.fallback.eur / 1000} actual={cmp.actual.eur / 1000} unit="k€" />
                <Button
                  onClick={() => declare(sh.allocationId, `${who === "importer" ? "DE" : "IT"}-CBAM-2026-${sh.mrn.slice(-4)}`)}
                  disabled={result?.status !== "open" || !allOk}
                  tone={result?.status === "declared" ? "done" : "importer"}
                >
                  <Icon name="check" /> {result?.status === "declared" ? "Declared" : "Surrender in the 2026 CBAM declaration"}
                </Button>
              </div>
            </div>
          </section>
        );
      })}
      {error && <Callout tone="danger" title={error} />}

      <section className="space-y-2">
        <CheatHeader />
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

      <section className="card space-y-3 p-4">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Icon name="stamp" className="h-4 w-4 text-verifier" /> If the verifier finds a problem later
        </h3>
        <p className="text-sm text-ink-2">Withdrawing a statement makes every passport that points at it fail at once, and frees its precursors for a corrected statement.</p>
        <Cheat
          label="Withdraw the statement: the gas meter's calibration had expired"
          explain="Run as the verifier, then watch the checks above turn red."
          disabled={!s.signed?.statementId}
          run={() => act("verifier", "revokeStatement", [s.signed!.statementId!, reasonHash("Gas meter calibration expired before Q3 2026")])}
          successText="Withdrawn. The passports above now fail the “Not revoked” check."
        />
      </section>
    </div>
  );
}
