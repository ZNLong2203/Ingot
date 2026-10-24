"use client";

import { fmt } from "@/lib/cbam/calculate";
import { compareWithDefault, sefaActualCoil, sefaDefaultCoil, turkeyDefaultSee } from "@/lib/cbam/cost";
import { factors } from "@/lib/cbam/factors";
import { latestPrice, sources } from "@/lib/cbam/rules";
import { installation } from "@/lib/samples/marmara";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Hash } from "@/components/ui/Hash";
import { Icon } from "@/components/ui/Icon";
import { Callout, More, Stat } from "@/components/ui/Kit";
import { useDerived } from "../hooks";
import { StepIntro } from "../StepIntro";

export const YEAR = 2026;

/** Two bars, labelled in ink; the colour only repeats what the label says. */
export function CostBars({ fallback, actual, unit = "€/t" }: { fallback: number; actual: number; unit?: string }) {
  const max = Math.max(fallback, actual, 1);
  const bars = [
    { label: "Default value", value: fallback, color: "var(--molten)" },
    { label: "Verified actual data", value: actual, color: "var(--verified)" },
  ];
  return (
    <figure className="space-y-2.5" aria-label={`CBAM cost per tonne: default ${fallback.toFixed(2)}, verified ${actual.toFixed(2)} ${unit}`}>
      {bars.map((b) => (
        <div key={b.label} className="grid grid-cols-[9.5rem_1fr_5.5rem] items-center gap-3 text-sm">
          <span className="font-medium text-ink-2">{b.label}</span>
          <span className="h-4 rounded-full bg-paper-2">
            <span className="block h-4 rounded-full" style={{ width: `${Math.max(2, (b.value / max) * 100)}%`, background: b.color }} />
          </span>
          <span className="num text-right font-semibold">
            {b.value.toFixed(2)} {unit}
          </span>
        </div>
      ))}
    </figure>
  );
}

export function Calculate({ onNext }: { onNext: () => void }) {
  const { result, precursors } = useDerived();
  if (!result) return <p className="text-sm text-muted">Read the documents first.</p>;

  const defaultSee = turkeyDefaultSee(installation.good.cnCode, YEAR);
  const sefa = sefaActualCoil({ year: YEAR, crudeSteelT: result.crudeSteelT, hotRolledT: result.hotRolledT, pigIronT: result.pigIronT });
  const cmp = compareWithDefault({ tonnes: result.hotRolledT, see: result.seeDirect, sefaActual: sefa.sefa, cnCode: installation.good.cnCode, year: YEAR, priceEur: latestPrice.eur });
  const processes = [
    { key: "eaf", title: "EAF steelmaking → crude steel", output: `${fmt(result.crudeSteelT)} t crude steel`, see: result.eaf.seeDirect },
    { key: "rolling", title: "Hot strip mill → hot-rolled coil (CN 7208 39 00)", output: `${fmt(result.hotRolledT)} t coil`, see: result.seeDirect },
  ] as const;

  const trace = (
    <div className="space-y-4">
      {processes.map((p) => (
        <section key={p.key} className="card overflow-hidden">
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line bg-engine-soft/50 px-4 py-2.5">
            <h3 className="font-display text-sm font-semibold">{p.title}</h3>
            <span className="text-xs text-muted">
              {p.output} · <b className="num text-engine">{p.see.toFixed(3)}</b> t CO2e/t direct
            </span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Calculation</th>
                  <th className="px-4 py-2 text-right font-medium">Direct t CO2e</th>
                  <th className="px-4 py-2 text-right font-medium">Indirect</th>
                </tr>
              </thead>
              <tbody>
                {result.trace
                  .filter((r) => r.process === p.key)
                  .map((r) => (
                    <tr key={r.label} className={`border-t border-line align-top ${r.stream === "precursor" ? "bg-chain-soft/60" : ""}`}>
                      <td className="px-4 py-2">
                        {r.label}
                        {r.stream === "precursor" && (
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                            <Badge tone="chain">
                              <Icon name="chain" className="h-3 w-3" /> from the ledger
                            </Badge>
                            {precursors.map((pr) => (
                              <span key={pr.allocationId}>
                                <Hash value={pr.allocationId} /> · {pr.verifierName}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-ink-2">{r.formula}</td>
                      <td className={`num px-4 py-2 text-right font-medium ${r.directT < 0 ? "text-verified" : ""}`}>{fmt(r.directT, 1)}</td>
                      <td className="num px-4 py-2 text-right text-muted">{r.indirectT ? fmt(r.indirectT, 1) : "—"}</td>
                    </tr>
                  ))}
                {p.key === "rolling" && (
                  <tr className="border-t border-line align-top">
                    <td className="px-4 py-2">Crude steel from the furnace (internal precursor)</td>
                    <td className="px-4 py-2 font-mono text-xs text-ink-2">
                      {fmt(result.crudeSteelT)} t × {result.eaf.seeDirect.toFixed(4)} t CO2e/t
                    </td>
                    <td className="num px-4 py-2 text-right font-medium">{fmt(result.eaf.directT, 1)}</td>
                    <td className="num px-4 py-2 text-right text-muted">{fmt(result.eaf.indirectT, 1)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <StepIntro
        role="engine"
        who="Ingot engine · the EU method"
        lead={
          <>
            The Commission&apos;s own formulas turn those lines into <span className="text-engine">tonnes of CO2 per tonne of coil</span>. The pig
            iron&apos;s carbon comes from the ledger, not from a form.
          </>
        }
        more={
          <p>
            Implementing Regulation (EU) 2025/2547: a carbon mass balance for the furnace (scrap, pig iron, electrodes and charge carbon in;
            steel out), combustion for the reheating furnace, crude steel as the internal precursor of the coil. Indirect emissions are reported
            but, for iron and steel, only direct emissions are charged (Annex II, Reg. 2023/956). Factors and sources are on the method page.
          </p>
        }
      />

      {result.missing.length > 0 && <Callout tone="danger" title="Something is missing">{result.missing.join("; ")}.</Callout>}

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Verified, this mill" value={result.seeDirect.toFixed(3)} tone="verified" sub={`t CO2e per tonne of coil · ${result.directKgPerTonne} kg/t on chain`} />
        <Stat label={`EU default for Türkiye, ${YEAR}`} value={<span className="line-through decoration-2">{defaultSee.toFixed(3)}</span>} tone="molten" sub="2.428 + the 10 % mark-up for missing data" />
        <Stat label="Indirect (reported only)" value={result.seeIndirect.toFixed(3)} sub={`grid at ${factors.gridEfTurkey.value} t CO2e/MWh · not charged for steel`} />
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-importer-soft px-5 py-4">
          <div className="flex items-center gap-3">
            <Icon name="coins" className="h-7 w-7 text-importer" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-importer">The EU importer saves</p>
              <p className="num font-display text-3xl font-extrabold text-importer">
                €{cmp.savingEurPerTonne.toFixed(2)} <span className="text-base font-semibold">per tonne</span>
              </p>
            </div>
          </div>
          <p className="num text-right text-sm text-ink-2">
            ≈ <b className="text-importer">€{(cmp.savingEur / 1e6).toFixed(1)} M</b> on this quarter&apos;s {fmt(result.hotRolledT)} t
            <span className="block text-xs text-muted">
              certificate €{latestPrice.eur} ({latestPrice.quarter}) · CBAM factor 97.5 %
            </span>
          </p>
        </div>
        <div className="p-5">
          <CostBars fallback={cmp.fallback.eurPerTonne} actual={cmp.actual.eurPerTonne} />
          <div className="mt-4" />
          <More label="How the certificates are counted">
            <p className="num text-xs">
              Verified: {result.seeDirect.toFixed(3)} − {sefa.sefa.toFixed(3)} free allocation adjustment (column A benchmarks through crude steel
              and pig iron) = {cmp.actual.netPerTonne.toFixed(3)} certificates/t.
            </p>
            <p className="num text-xs">
              Default: {defaultSee.toFixed(3)} − {sefaDefaultCoil(YEAR).toFixed(3)} (column B, route C as the act sets for Türkiye) ={" "}
              {cmp.fallback.netPerTonne.toFixed(3)} certificates/t.
            </p>
            <p className="text-xs">
              Every 0.1 t CO2e/t the mill cuts is now worth €{(0.1 * latestPrice.eur).toFixed(2)}/t to its buyers; on default values it is worth
              nothing.{" "}
              <a className="underline" href={sources.defaults.url}>
                Default values
              </a>
            </p>
          </More>
        </div>
      </section>

      <div className="space-y-2">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Icon name="calc" className="h-4 w-4 text-engine" /> Every line of the calculation
        </h3>
        {trace}
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={result.missing.length > 0} tone="verifier">
          Hand to the verifier <Icon name="arrow" />
        </Button>
      </div>
    </div>
  );
}
