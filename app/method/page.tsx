import type { Metadata } from "next";
import Link from "next/link";
import { ranges } from "@/lib/cbam/checks";
import { factors } from "@/lib/cbam/factors";
import { benchmarks, cbamFactor, certificatePrices, sources, turkeyDefaults } from "@/lib/cbam/rules";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Method & limits",
  description: "How Ingot calculates CBAM embedded emissions, which factors and benchmarks it uses and where they come from, what the contract guarantees, and what it does not.",
};

const H2 = ({ children, id }: { children: React.ReactNode; id: string }) => (
  <h2 id={id} className="mt-12 scroll-mt-20 font-display text-2xl font-bold tracking-tight">
    {children}
  </h2>
);

export default function MethodPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">Method &amp; limits</p>
      <h1 className="font-display text-3xl font-bold tracking-tight">How the numbers are made, and what they cannot tell you</h1>
      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
        {[
          ["calculation", "Calculation"],
          ["factors", "Factors"],
          ["obligation", "CBAM obligation"],
          ["ledger", "Ledger rules"],
          ["ai", "AI"],
          ["security", "Security"],
          ["limits", "Limits"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="underline decoration-line-strong underline-offset-4 hover:text-ink">
            {label}
          </a>
        ))}
      </nav>

      <H2 id="calculation">Calculation</H2>
      <p className="mt-3 text-ink-2">
        Ingot follows the definitive-period methodology, Commission Implementing Regulation (EU) 2025/2547, for a scrap-based electric arc
        furnace (EAF) with a hot strip mill. Two production processes are modelled, as the regulation requires for complex goods:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-card p-4 font-mono text-xs leading-relaxed">{`EAF steelmaking (crude steel, CN 7207)
  AttrEm  = Σ carbon in − Σ carbon out          carbon mass balance, Annex I 3.15.2.2
          = scrap×0.04 + pig iron×0.15 + electrodes×3.00 + charge carbon×3.04
            − crude steel×0.04 + raw dolomite×0.477
  EE      = AttrEm + Σ M_i × SEE_i              precursors: verified pig iron, read from the ledger
  SEE     = EE / AL(crude steel)

Hot rolling (hot-rolled coil, CN 7208 39 00)
  AttrEm  = gas × NCV × 56.1 t CO2/TJ × OF(1)    combustion, Annex II B.3.1.1
  EE      = AttrEm + M(crude steel) × SEE(crude steel)
  SEE     = EE / AL(coil)                        direct only counts for iron and steel`}</pre>
      <p className="mt-3 text-sm text-ink-2">
        Gas invoices in Türkiye state standard cubic metres (15 °C) and the gross calorific value; net energy is taken as 90 % of gross. Grid
        electricity is converted to indirect emissions and reported, but for iron and steel only direct emissions count towards the obligation
        (Annex II of Regulation (EU) 2023/956). The demo mill&apos;s result is 0.354 t CO2e per tonne of coil, of which 0.201 comes with the pig
        iron.
      </p>

      <H2 id="factors">Factors, defaults and benchmarks</H2>
      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Factor</th>
              <th className="px-4 py-2 text-right font-medium">Value</th>
              <th className="px-4 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(factors).map(([k, f]) => (
              <tr key={k} className="border-t border-line align-top">
                <td className="px-4 py-2 font-mono text-xs">{k}</td>
                <td className="num px-4 py-2 text-right">
                  {Number(f.value.toFixed(6))} <span className="text-xs text-muted">{f.unit}</span>
                </td>
                <td className="px-4 py-2 text-xs text-ink-2">
                  {"url" in f && f.url ? (
                    <a className="underline" href={f.url}>
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

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-line bg-card p-4 text-sm">
          <h3 className="font-semibold">Default values for Türkiye (before mark-up)</h3>
          <ul className="mt-2 space-y-1 text-ink-2">
            {Object.entries(turkeyDefaults).map(([cn, d]) => (
              <li key={cn} className="flex justify-between gap-3">
                <span>
                  CN {cn} {d.label}
                </span>
                <span className="num">{d.value.toFixed(3)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Mark-up +10 % in 2026, +20 % in 2027, +30 % from 2028.{" "}
            <a className="underline" href={sources.defaults.url}>
              {sources.defaults.label}
            </a>
          </p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4 text-sm">
          <h3 className="font-semibold">Benchmarks for the free allocation adjustment</h3>
          <ul className="mt-2 space-y-1 text-ink-2">
            <li className="flex justify-between gap-3">
              <span>CN 7208, column A (actual data)</span>
              <span className="num">{benchmarks.hotRolled.columnA}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>CN 7208, column B (default), routes C / D / E</span>
              <span className="num">
                {benchmarks.hotRolled.columnB.C} / {benchmarks.hotRolled.columnB.D} / {benchmarks.hotRolled.columnB.E}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span>CN 7207 crude steel, column A, route E</span>
              <span className="num">{benchmarks.crudeSteel.columnA.E}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>CN 7201 pig iron, column A</span>
              <span className="num">{benchmarks.pigIron.columnA}</span>
            </li>
          </ul>
          <p className="mt-2 text-xs text-muted">
            <a className="underline" href={sources.benchmarks.url}>
              {sources.benchmarks.label}
            </a>
            . The 2026 values are provisional until the EU ETS 2026–2030 benchmarks are final.
          </p>
        </div>
      </div>

      <H2 id="obligation">CBAM obligation</H2>
      <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-card p-4 font-mono text-xs leading-relaxed">{`certificates = M × (SEE − SEFA_y) − carbon price deduction       Reg. 2023/956 Art. 6(2), 9, 31

actual data   SEFA_coil  = CBAM_y × CSCF × BM*_coil + m_crude × SEFA_crude     Reg. 2025/2620 eq. 2, 4
              SEFA_crude = CBAM_y × CSCF × BM*_crude + m_pig × SEFA_pig
              SEFA_pig   = CBAM_y × CSCF × BM*_pig
default       SEFA_coil  = CBAM_y × CSCF × BM_coil(route C)                     eq. 6`}</pre>
      <p className="mt-3 text-sm text-ink-2">
        CBAM factor by year:{" "}
        {Object.entries(cbamFactor)
          .map(([y, f]) => `${y} ${(f * 100).toFixed(1)} %`)
          .join(" · ")}{" "}
        (
        <a className="underline" href={sources.cbamFactor.url}>
          Directive 2003/87/EC Art. 10a(1a)
        </a>
        ). CSCF is 100 % for 2026–2030. Published certificate prices for 2026:{" "}
        {certificatePrices.map((p) => `${p.quarter} €${p.eur}`).join(" · ")} (
        <a className="underline" href={sources.prices.url}>
          Commission
        </a>
        ). Türkiye&apos;s ETS pilot (2026–2027) allocates for free, so the demo assumes no carbon price paid at origin. No article states a floor
        at zero; the demo floors each consignment at zero.
      </p>
      <p className="mt-3 text-sm text-ink-2">
        For the demo mill in 2026 at €82.32: verified data gives 0.354 − 0.221 = 0.132 certificates per tonne (€10.90); the default gives 2.671 −
        1.336 = 1.335 (€109.90). The difference, about €99 per tonne, is what makes verification worth paying for, and what makes every tonne of
        CO2 the mill avoids worth money to its buyers.
      </p>

      <H2 id="ledger">What the registry contract guarantees</H2>
      <ul className="mt-4 space-y-2 text-sm text-ink-2">
        <li>
          <b className="text-ink">Accredited signatures.</b> A statement is recorded only with an EIP-712 signature from a verifier whose
          accreditation is current. Changing any field after signing breaks the signature (<code>NotAccreditedVerifier</code>); signatures expire;
          the domain separator binds them to one chain and one contract.
        </li>
        <li>
          <b className="text-ink">Verified once.</b> Statements for one installation and CN code cannot overlap in time (<code>PeriodOverlaps</code>).
          The same signed statement cannot be submitted twice (<code>StatementExists</code>).
        </li>
        <li>
          <b className="text-ink">Sold once.</b> Allocations never exceed the verified quantity (<code>ExceedsVerifiedQuantity</code>), and one
          customs reference carries one allocation (<code>ShipmentAlreadyAllocated</code>).
        </li>
        <li>
          <b className="text-ink">Ends once.</b> An allocation is declared by its recipient or consumed by a downstream statement, never both and
          never twice (<code>AllocationNotOpen</code>, <code>NotRecipient</code>).
        </li>
        <li>
          <b className="text-ink">No laundering.</b> A downstream statement must state the precursor emissions the contract recomputes from the
          upstream statements (<code>PrecursorEmissionsMismatch</code>), its total must not fall below them (<code>BelowPrecursorEmissions</code>),
          and the inputs must be the ones the verifier signed (<code>InputsMismatch</code>).
        </li>
        <li>
          <b className="text-ink">Withdrawal.</b> The signing verifier or the authority can withdraw a statement; its open allocations can no
          longer be declared or consumed.
        </li>
        <li>
          <b className="text-ink">Selective disclosure.</b> Only a Merkle root of the salted report fields is stored. Any field can be proven
          against it, on chain (<code>verifyDisclosure</code>) or off chain, without revealing the others.
        </li>
      </ul>
      <p className="mt-3 text-sm text-ink-2">
        21 contract tests (Hardhat 3, node:test, viem) cover each rule, including a 60-step randomised allocation sequence; 22 unit tests cover the
        engine, the disclosure proofs, the in-browser EVM and the full demo flow.
      </p>

      <H2 id="ai">AI</H2>
      <p className="mt-3 text-sm text-ink-2">
        Claude Opus 5.5 reads each document and returns schema-checked lines, each with the verbatim text it came from. It never computes. The
        deterministic engine does the arithmetic, and the verifier sees every quote next to every number. Uploaded files go to the model and are
        not stored. Plausibility checks use the ranges below; they flag what deserves a second look and do not replace the site visit.
      </p>
      <ul className="mt-3 space-y-1 text-xs text-ink-2">
        {Object.entries(ranges).map(([k, r]) => (
          <li key={k}>
            <span className="font-mono">{k}</span>: {r.min}–{r.max} {r.unit} · {r.source}
          </li>
        ))}
      </ul>

      <H2 id="security">Security and data integrity</H2>
      <p className="mt-3 text-sm text-ink-2">
        The threat model, the attacker each rule stops, and what remains outside the contract&apos;s reach are in{" "}
        <a className="underline" href={`${site.repo}/blob/main/docs/security.md`}>
          docs/security.md
        </a>
        . In short: forged evidence is the verifier&apos;s to catch; a colluding verifier can still sign false own-emissions, but cannot launder
        precursor carbon, cannot reuse tonnes and can be suspended, which voids future signatures.
      </p>

      <H2 id="limits">Limits</H2>
      <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-ink-2">
        <li>Companies, documents and quantities in the demo are fictional; they sit inside the EU BAT ranges cited above.</li>
        <li>The demo runs the real contract on an EVM in your browser. On a public chain the verified tonnage per statement would be visible; a production deployment would use a permissioned EVM network run by chambers of industry and verifiers, with the same contract.</li>
        <li>Ingot does not replace the accredited verifier, the site visit, or the EU CBAM Registry (whose O3CI module lets operators upload once). It adds a shared count of verified tonnes across buyers and supply-chain tiers.</li>
        <li>Partial consumption of a precursor allocation is not modelled; a supplier splits deliveries into separate allocations instead.</li>
        <li>The route reading of the benchmark indicators, the floor at zero and the carbon-price deduction formula are stated assumptions, marked in the code.</li>
        <li>The model can misread a number. Every number shows its source text, the checks flag outliers, and the verifier signs only what they have checked.</li>
      </ul>
      <p className="mt-8 text-sm">
        <Link href="/demo" className="underline">
          Try the flow
        </Link>{" "}
        ·{" "}
        <a href={site.repo} className="underline">
          Source code
        </a>
      </p>
    </main>
  );
}
