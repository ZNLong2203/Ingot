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
import { useDerived } from "../hooks";

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
          <span className="text-ink-2">{b.label}</span>
          <span className="h-3 rounded-full bg-paper-2">
            <span className="block h-3 rounded-full" style={{ width: `${Math.max(2, (b.value / max) * 100)}%`, background: b.color }} />
          </span>
          <span className="num text-right font-medium">
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

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-ink-2">
        The engine follows the Commission&apos;s method (Implementing Regulation (EU) 2025/2547): emissions of each source stream, then the
        precursors that went in, divided by what came out. Crude steel from the furnace is the internal precursor of the rolled coil. The
        pig iron&apos;s emissions are not typed in: they come from the smelter&apos;s verified statement on the ledger.
      </p>

      {result.missing.length > 0 && (
        <p className="rounded-lg bg-refused-soft px-3 py-2 text-sm text-refused">Missing: {result.missing.join("; ")}.</p>
      )}

      {processes.map((p) => (
        <section key={p.key} className="overflow-hidden rounded-lg border border-line bg-card">
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
            <h3 className="font-display text-sm font-semibold">{p.title}</h3>
            <span className="text-xs text-muted">
              {p.output} · <span className="num">{p.see.toFixed(3)}</span> t CO2e/t direct
            </span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Calculation</th>
                  <th className="px-4 py-2 text-right font-medium">Direct t CO2e</th>
                  <th className="px-4 py-2 text-right font-medium">Indirect t CO2e</th>
                </tr>
              </thead>
              <tbody>
                {result.trace
                  .filter((r) => r.process === p.key)
                  .map((r) => (
                    <tr key={r.label} className="border-t border-line align-top">
                      <td className="px-4 py-2">
                        {r.label}
                        {r.stream === "precursor" && (
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                            <Badge tone="chain">
                              <Icon name="chain" className="h-3 w-3" /> from the ledger
                            </Badge>
                            {precursors.map((pr) => (
                              <span key={pr.allocationId}>
                                allocation <Hash value={pr.allocationId} /> · signed by {pr.verifierName}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-ink-2">{r.formula}</td>
                      <td className="num px-4 py-2 text-right">{fmt(r.directT, 1)}</td>
                      <td className="num px-4 py-2 text-right text-muted">{r.indirectT ? fmt(r.indirectT, 1) : "—"}</td>
                    </tr>
                  ))}
                {p.key === "rolling" && (
                  <tr className="border-t border-line align-top">
                    <td className="px-4 py-2">Crude steel from the furnace (internal precursor)</td>
                    <td className="px-4 py-2 font-mono text-xs text-ink-2">
                      {fmt(result.crudeSteelT)} t × {result.eaf.seeDirect.toFixed(4)} t CO2e/t
                    </td>
                    <td className="num px-4 py-2 text-right">{fmt(result.eaf.directT, 1)}</td>
                    <td className="num px-4 py-2 text-right text-muted">{fmt(result.eaf.indirectT, 1)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Specific embedded emissions</p>
          <p className="num mt-1 font-display text-3xl font-bold">{result.seeDirect.toFixed(3)}</p>
          <p className="text-sm text-ink-2">t CO2e per tonne of coil, direct · {result.directKgPerTonne} kg/t on chain</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Indirect (reported, not charged)</p>
          <p className="num mt-1 font-display text-3xl font-bold text-ink-2">{result.seeIndirect.toFixed(3)}</p>
          <p className="text-sm text-ink-2">
            Grid electricity at {factors.gridEfTurkey.value} t CO2/MWh. Iron and steel pay on direct emissions only (Annex II, Reg. 2023/956).
          </p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Default value for Türkiye, {YEAR}</p>
          <p className="num mt-1 font-display text-3xl font-bold text-molten">{defaultSee.toFixed(3)}</p>
          <p className="text-sm text-ink-2">
            2.428 plus the 10 % mark-up the EU adds when there is no verified data.{" "}
            <a className="underline" href={sources.defaults.url}>
              Source
            </a>
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-line bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-sm font-semibold">What the EU importer pays per tonne of this coil</h3>
          <span className="text-xs text-muted">certificate price €{latestPrice.eur} ({latestPrice.quarter}, latest published) · CBAM factor 97.5 % in {YEAR}</span>
        </div>
        <div className="mt-4">
          <CostBars fallback={cmp.fallback.eurPerTonne} actual={cmp.actual.eurPerTonne} />
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-1 text-xs text-ink-2 sm:grid-cols-2">
          <div>
            <dt className="inline text-muted">Verified: </dt>
            <dd className="inline num">
              {result.seeDirect.toFixed(3)} − free allocation adjustment {sefa.sefa.toFixed(3)} (column A benchmarks through crude steel and pig
              iron) = {cmp.actual.netPerTonne.toFixed(3)} certificates/t
            </dd>
          </div>
          <div>
            <dt className="inline text-muted">Default: </dt>
            <dd className="inline num">
              {defaultSee.toFixed(3)} − {sefaDefaultCoil(YEAR).toFixed(3)} (column B, route C as the act sets for Türkiye) ={" "}
              {cmp.fallback.netPerTonne.toFixed(3)} certificates/t
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm">
          Verified data saves <b className="num">€{cmp.savingEurPerTonne.toFixed(2)}</b> per tonne, about{" "}
          <b className="num">€{(cmp.savingEur / 1e6).toFixed(1)} million</b> on this quarter&apos;s {fmt(result.hotRolledT)} t if it all went
          to the EU. Every 0.1 t CO2e/t the mill cuts is now worth €{(0.1 * latestPrice.eur).toFixed(2)}/t to its buyers; on default values it
          is worth nothing.
        </p>
      </section>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={result.missing.length > 0}>
          Hand to the verifier <Icon name="arrow" />
        </Button>
      </div>
    </div>
  );
}
