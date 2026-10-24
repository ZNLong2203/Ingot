import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { IconDot, More } from "@/components/ui/Kit";
import { ranges } from "@/lib/cbam/checks";
import { factors } from "@/lib/cbam/factors";
import { benchmarks, cbamFactor, certificatePrices, sources, turkeyDefaults } from "@/lib/cbam/rules";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Method & limits",
  description: "How Ingot calculates CBAM embedded emissions, which factors and benchmarks it uses and where they come from, what the contract guarantees, and what it does not.",
};

function Section({ id, icon, tone, title, lead, children }: { id: string; icon: IconName; tone: "mill" | "engine" | "verifier" | "importer" | "chain" | "molten" | "verified" | "refused"; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 pt-14">
      <div className="flex items-start gap-3">
        <IconDot icon={icon} tone={tone} size="lg" />
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
          {lead && <p className="mt-1 max-w-2xl text-ink-2">{lead}</p>}
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

const eaf = [
  { name: "Steel scrap", f: "0.04", sign: "+", note: "carbon in" },
  { name: "Pig iron", f: "0.15", sign: "+", note: "carbon in" },
  { name: "Graphite electrodes", f: "3.00", sign: "+", note: "carbon in" },
  { name: "Charge carbon", f: "3.04", sign: "+", note: "carbon in" },
  { name: "Raw dolomite", f: "0.477", sign: "+", note: "decomposition" },
  { name: "Crude steel", f: "0.04", sign: "−", note: "carbon out" },
];

const guarantees: { title: string; error: string; body: string; icon: IconName }[] = [
  { title: "Accredited signatures", error: "NotAccreditedVerifier", body: "Any field changed after signing breaks the EIP-712 signature.", icon: "stamp" },
  { title: "Verified once", error: "PeriodOverlaps", body: "No overlapping periods per installation and product.", icon: "layers" },
  { title: "Sold once", error: "ExceedsVerifiedQuantity", body: "Allocations never pass the verified tonnes; one per customs reference.", icon: "ship" },
  { title: "Ends once", error: "AllocationNotOpen", body: "Declared or consumed downstream, never both, never twice.", icon: "check" },
  { title: "No laundering", error: "BelowPrecursorEmissions", body: "Precursor carbon recomputed on chain; the product cannot carry less.", icon: "flame" },
  { title: "Private by default", error: "verifyDisclosure", body: "Only a salted Merkle root on chain; fields proven one at a time.", icon: "lock" },
];

const years = Object.entries(cbamFactor);

export default function MethodPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-10 sm:px-6">
      <header className="bg-hero -mx-4 border-b border-line px-4 pb-10 pt-12 sm:-mx-6 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-chain">Method &amp; limits</p>
        <h1 className="mt-2 max-w-3xl font-display text-4xl font-extrabold tracking-tight">
          How the numbers are made, and <span className="text-gradient">what they cannot tell you</span>
        </h1>
        <nav className="mt-6 flex flex-wrap gap-2 text-sm">
          {[
            ["calculation", "Calculation", "calc"],
            ["factors", "Factors", "layers"],
            ["obligation", "CBAM cost", "coins"],
            ["ledger", "Contract rules", "shieldCheck"],
            ["ai", "AI & security", "spark"],
            ["limits", "Limits", "info"],
          ].map(([id, label, icon]) => (
            <a key={id} href={`#${id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 font-medium text-ink-2 hover:border-line-strong hover:text-ink">
              <Icon name={icon as IconName} className="h-4 w-4" /> {label}
            </a>
          ))}
        </nav>
      </header>

      <Section id="calculation" icon="calc" tone="engine" title="Calculation" lead="Two production processes, exactly as Implementing Regulation (EU) 2025/2547 asks for complex goods.">
        <div className="grid gap-4 md:grid-cols-2">
          <article className="card overflow-hidden">
            <div className="flex items-center justify-between bg-mill-soft px-4 py-3">
              <h3 className="font-semibold text-mill">1 · EAF steelmaking</h3>
              <span className="text-xs font-medium text-ink-2">carbon mass balance</span>
            </div>
            <ul className="divide-y divide-line text-sm">
              {eaf.map((x) => (
                <li key={x.name} className="flex items-center justify-between px-4 py-2">
                  <span className="flex items-center gap-2">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${x.sign === "+" ? "bg-molten-soft text-molten" : "bg-verified-soft text-verified"}`}>{x.sign}</span>
                    {x.name}
                    <span className="text-xs text-muted">{x.note}</span>
                  </span>
                  <span className="num font-mono text-xs font-semibold">× {x.f}</span>
                </li>
              ))}
              <li className="flex items-center justify-between bg-chain-soft/60 px-4 py-2">
                <span className="flex items-center gap-2">
                  <Icon name="chain" className="h-4 w-4 text-chain" /> Verified pig iron, from the ledger
                </span>
                <span className="num font-mono text-xs font-semibold">× 1.91</span>
              </li>
            </ul>
          </article>
          <article className="card overflow-hidden">
            <div className="flex items-center justify-between bg-engine-soft px-4 py-3">
              <h3 className="font-semibold text-engine">2 · Hot rolling</h3>
              <span className="text-xs font-medium text-ink-2">combustion</span>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <p className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                {["gas Sm³", "× 9,155 kcal", "× 0.9 NCV", "× 56.1 t/TJ"].map((t) => (
                  <span key={t} className="rounded-md bg-paper-2 px-2 py-1">
                    {t}
                  </span>
                ))}
              </p>
              <p className="flex items-center gap-2">
                <Icon name="layers" className="h-4 w-4 text-engine" /> plus crude steel from step 1 as the internal precursor
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="rounded-xl bg-verified-soft p-3">
                  <p className="text-[11px] font-semibold uppercase text-verified">Demo mill</p>
                  <p className="num font-display text-2xl font-extrabold text-verified">0.354</p>
                  <p className="text-xs text-ink-2">t CO2e / t coil</p>
                </div>
                <div className="rounded-xl bg-chain-soft p-3">
                  <p className="text-[11px] font-semibold uppercase text-chain">of which pig iron</p>
                  <p className="num font-display text-2xl font-extrabold text-chain">0.201</p>
                  <p className="text-xs text-ink-2">carried from upstream</p>
                </div>
              </div>
              <p className="text-xs text-muted">Indirect (grid) emissions are reported but not charged for iron and steel (Annex II, Reg. 2023/956).</p>
            </div>
          </article>
        </div>
        <div className="mt-4">
          <More label="Show the equations">
            <pre className="overflow-x-auto rounded-lg bg-paper-2 p-3 font-mono text-xs leading-relaxed">{`EAF        AttrEm = Σ carbon in − Σ carbon out (+ carbonates)    Annex I 3.15.2.2
           EE     = AttrEm + Σ M_i × SEE_i                      verified precursors
           SEE    = EE / AL(crude steel)
Rolling    AttrEm = fuel × NCV × EF × OF                         Annex II B.3.1.1
           EE     = AttrEm + M(crude steel) × SEE(crude steel)
           SEE    = EE / AL(coil)`}</pre>
          </More>
        </div>
      </Section>

      <Section id="factors" icon="layers" tone="mill" title="Factors, defaults and benchmarks" lead="Every number the engine uses, with the act it comes from.">
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper-2 text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Factor</th>
                <th className="px-4 py-2.5 text-right font-semibold">Value</th>
                <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Source</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(factors).map(([k, f]) => (
                <tr key={k} className="border-t border-line align-top">
                  <td className="px-4 py-2 font-mono text-xs text-ink-2">{k}</td>
                  <td className="num px-4 py-2 text-right">
                    <b className="text-mill">{Number(f.value.toFixed(6))}</b> <span className="text-xs text-muted">{f.unit}</span>
                  </td>
                  <td className="hidden px-4 py-2 text-xs text-ink-2 sm:table-cell">
                    {"url" in f && f.url ? (
                      <a className="underline decoration-line-strong underline-offset-2" href={f.url}>
                        {f.source}
                      </a>
                    ) : (
                      f.source
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="card p-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <span className="text-xl">🇹🇷</span> Türkiye default values
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              {Object.entries(turkeyDefaults).map(([cn, d]) => (
                <li key={cn} className="flex justify-between gap-3">
                  <span className="text-ink-2">
                    <span className="font-mono text-xs text-muted">{cn}</span> {d.label}
                  </span>
                  <b className="num text-molten">{d.value.toFixed(3)}</b>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              +10 % in 2026, +20 % in 2027, +30 % from 2028 ·{" "}
              <a className="underline" href={sources.defaults.url}>
                Reg. 2025/2621
              </a>
            </p>
          </article>
          <article className="card p-4">
            <h3 className="font-semibold">Free allocation benchmarks (CN 7208)</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-verified-soft p-3">
                <p className="text-[11px] font-semibold uppercase text-verified">Column A · actual data</p>
                <p className="num font-display text-2xl font-extrabold text-verified">{benchmarks.hotRolled.columnA}</p>
                <p className="text-xs text-ink-2">+ precursors: crude steel {benchmarks.crudeSteel.columnA.E}, pig iron {benchmarks.pigIron.columnA}</p>
              </div>
              <div className="rounded-xl bg-molten-soft p-3">
                <p className="text-[11px] font-semibold uppercase text-molten">Column B · defaults</p>
                <p className="num font-display text-2xl font-extrabold text-molten">{benchmarks.hotRolled.columnB.C}</p>
                <p className="text-xs text-ink-2">
                  route C (D {benchmarks.hotRolled.columnB.D}, E {benchmarks.hotRolled.columnB.E})
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">
              <a className="underline" href={sources.benchmarks.url}>
                Reg. 2025/2620
              </a>
              ; 2026 values provisional.
            </p>
          </article>
        </div>
      </Section>

      <Section id="obligation" icon="coins" tone="importer" title="What the importer pays" lead="Certificates = tonnes × (embedded emissions − free allocation adjustment), floored at zero.">
        <div className="space-y-3">
          {[
            { label: "Verified", tone: "verified", see: "0.354", sefa: "0.221", net: "0.132", eur: "€10.90" },
            { label: "Default", tone: "molten", see: "2.671", sefa: "1.336", net: "1.335", eur: "€109.90" },
          ].map((r) => (
            <div key={r.label} className="card flex flex-wrap items-center gap-2 p-4 text-sm">
              <span className={`w-20 font-semibold ${r.tone === "verified" ? "text-verified" : "text-molten"}`}>{r.label}</span>
              <span className="num rounded-lg bg-paper-2 px-2.5 py-1.5 font-semibold">{r.see}</span>
              <span className="text-muted">−</span>
              <span className="num rounded-lg bg-paper-2 px-2.5 py-1.5">{r.sefa}</span>
              <span className="text-muted">=</span>
              <span className="num rounded-lg bg-paper-2 px-2.5 py-1.5 font-semibold">{r.net}</span>
              <span className="text-muted">certificates/t × €82.32 =</span>
              <span className={`num rounded-lg px-3 py-1.5 font-display text-lg font-extrabold ${r.tone === "verified" ? "bg-verified-soft text-verified" : "bg-molten-soft text-molten"}`}>{r.eur} / t</span>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <figure className="card p-4">
            <figcaption className="text-sm font-semibold">CBAM factor: the share of free allocation still credited</figcaption>
            <div className="mt-4 flex h-32 items-end gap-2" role="img" aria-label="CBAM factor falls from 97.5 percent in 2026 to 0 in 2034">
              {years.map(([y, f]) => (
                <div key={y} className="flex flex-1 flex-col items-center gap-1">
                  <span className="num text-[10px] text-muted">{Number((f * 100).toFixed(1))}%</span>
                  <span className="w-full rounded-t-md bg-gradient-to-t from-[var(--engine)] to-[var(--verifier)]" style={{ height: `${Math.max(f * 96, 2)}px` }} />
                  <span className="num text-[10px] text-muted">{y.slice(2)}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              <a className="underline" href={sources.cbamFactor.url}>
                Directive 2003/87/EC Art. 10a(1a)
              </a>
              . As it falls, every tonne of CO2 counts in full.
            </p>
          </figure>
          <article className="card p-4 text-sm">
            <h3 className="font-semibold">Certificate prices 2026</h3>
            <ul className="mt-3 space-y-2">
              {certificatePrices.map((p) => (
                <li key={p.quarter} className="flex items-center justify-between">
                  <span className="text-ink-2">{p.quarter}</span>
                  <b className="num text-importer">€{p.eur}</b>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              <a className="underline" href={sources.prices.url}>
                European Commission
              </a>
              . Türkiye&apos;s ETS pilot allocates for free, so no carbon price paid at origin is deducted.
            </p>
          </article>
        </div>
      </Section>

      <Section id="ledger" icon="shieldCheck" tone="verified" title="What the contract guarantees" lead="Each rule is a custom error, covered by tests and reachable from the demo.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {guarantees.map((g) => (
            <article key={g.title} className="card p-4">
              <div className="flex items-center gap-2">
                <IconDot icon={g.icon} tone="verified" />
                <h3 className="font-semibold">{g.title}</h3>
              </div>
              <p className="mt-2 text-sm text-ink-2">{g.body}</p>
              <code className="mt-3 inline-block rounded-md bg-refused-soft px-2 py-0.5 text-[11px] font-medium text-refused">{g.error}</code>
            </article>
          ))}
        </div>
        <p className="mt-4 flex flex-wrap gap-2 text-xs">
          {["21 contract tests", "22 unit tests", "60-step randomised allocation test", "browser walkthrough in CI-ready Playwright"].map((t) => (
            <span key={t} className="rounded-full bg-verified-soft px-2.5 py-1 font-medium text-verified">
              {t}
            </span>
          ))}
        </p>
      </Section>

      <Section id="ai" icon="spark" tone="verifier" title="AI and security">
        <div className="grid gap-4 md:grid-cols-2">
          <article className="card p-4 text-sm">
            <h3 className="flex items-center gap-2 font-semibold">
              <Icon name="spark" className="h-4 w-4 text-mill" /> The model only reads
            </h3>
            <ul className="mt-2 space-y-1.5 text-ink-2">
              <li>· Claude Opus 5.5, schema-checked output</li>
              <li>· Every number with its verbatim source text</li>
              <li>· No arithmetic, no judgement, files not stored</li>
              <li>· Outliers flagged against cited EU BAT ranges</li>
            </ul>
            <More label="Plausibility ranges">
              <ul className="space-y-1 text-xs">
                {Object.entries(ranges).map(([k, r]) => (
                  <li key={k}>
                    <span className="font-mono">{k}</span>: {r.min}–{r.max} {r.unit} · {r.source}
                  </li>
                ))}
              </ul>
            </More>
          </article>
          <article className="card p-4 text-sm">
            <h3 className="flex items-center gap-2 font-semibold">
              <Icon name="shield" className="h-4 w-4 text-verifier" /> Threat model
            </h3>
            <ul className="mt-2 space-y-1.5 text-ink-2">
              <li>· 19 threats mapped to a control and a test</li>
              <li>· A bribed verifier still cannot launder precursor carbon or reuse tonnes</li>
              <li>· Verifiers are time-limited and suspendable; statements can be withdrawn</li>
            </ul>
            <a className="mt-3 inline-flex items-center gap-1 font-semibold text-verifier hover:underline" href={`${site.repo}/blob/main/docs/security.md`}>
              Read docs/security.md <Icon name="arrow" />
            </a>
          </article>
        </div>
      </Section>

      <Section id="limits" icon="info" tone="chain" title="Limits" lead="Said plainly, so nobody has to find them.">
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          {[
            "Companies, documents and quantities are fictional, inside the EU BAT ranges.",
            "On a public chain, tonnage per statement is visible; production would use a permissioned EVM network.",
            "Ingot does not replace the verifier, the site visit or the EU CBAM Registry; it adds one shared count of tonnes.",
            "Partial use of a precursor allocation is not modelled; suppliers split deliveries instead.",
            "The benchmark route reading, the floor at zero and the carbon-price deduction are stated assumptions.",
            "The model can misread a number: every number shows its source, and a person signs.",
          ].map((t) => (
            <li key={t} className="card flex items-start gap-2 p-3">
              <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-chain" />
              <span className="text-ink-2">{t}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-paper hover:bg-ink-2">
            <Icon name="play" /> Try the flow
          </Link>
          <a href={site.repo} className="inline-flex items-center gap-2 rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold hover:bg-paper-2">
            Source code
          </a>
        </div>
      </Section>
    </main>
  );
}
