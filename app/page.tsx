import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { site } from "@/lib/site";

const stats = [
  { value: "€10.8 bn", label: "CBAM-covered goods Türkiye sold to the EU in 2025, second only to China", source: "Eurostat Comext via cbamguide.com" },
  { value: "2.671", label: "t CO2e per tonne: the EU's 2026 default for Turkish hot-rolled coil, mark-up included", source: "Reg. (EU) 2025/2621" },
  { value: "0.354", label: "t CO2e per tonne: the demo mill's verified figure, scrap-based EAF", source: "Ingot calculation" },
  { value: "≈ €99", label: "less per tonne for the EU importer when the verified figure can be trusted", source: "Q3 2026 certificate price €82.32" },
];

const doors = [
  {
    title: "A tonne is verified once",
    body: "Statements for the same installation and product cannot cover overlapping periods.",
    error: "PeriodOverlaps",
  },
  {
    title: "A tonne is sold once",
    body: "Allocations never exceed the verified quantity, and a customs reference carries one allocation.",
    error: "ExceedsVerifiedQuantity",
  },
  {
    title: "A tonne ends once",
    body: "Each allocation is either surrendered in one CBAM declaration or consumed as a precursor downstream.",
    error: "AllocationNotOpen",
  },
  {
    title: "Carbon cannot be laundered",
    body: "A product must carry at least the embedded emissions of the verified precursors it consumed. The contract recomputes them.",
    error: "BelowPrecursorEmissions",
  },
];

const steps = [
  { icon: "doc", title: "AI reads the evidence", body: "Turkish gas invoices, the electricity statement, the production report, the pig iron delivery note. Claude quotes the line behind every number and does no arithmetic." },
  { icon: "spark", title: "The EU method, in code", body: "Carbon mass balance for the furnace, combustion for the reheating furnace, verified precursors from the ledger, the column A benchmarks and the 2026 CBAM factor." },
  { icon: "sign", title: "The verifier signs", body: "Plausibility checks against the EU BAT reference documents, then an EIP-712 signature over the statement and a Merkle root of the private report." },
  { icon: "ship", title: "Each tonne travels once", body: "Shipments take tonnes from the statement and carry a passport. The importer checks it against the ledger and surrenders it in one declaration." },
] as const;

export default function Home() {
  return (
    <main>
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-20">
          <div>
            <p className="text-sm font-medium text-molten">IEEE ClimateChain 2026 · {site.track}</p>
            <h1 className="mt-3 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              Every tonne carries its carbon. <span className="text-molten">Once.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-2">
              Since January 2026 EU importers pay for the carbon in steel, aluminium, cement and fertiliser. Without verified data they pay on
              punitive default values. Ingot turns a mill&apos;s invoices into a verified CBAM statement, then lets each verified tonne travel
              through precursors, shipments and customs to exactly one declaration.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/demo" className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-paper hover:bg-ink-2">
                Try the flow <Icon name="arrow" />
              </Link>
              <Link href="/method" className="inline-flex items-center gap-2 rounded-md border border-line-strong px-4 py-2.5 text-sm font-medium hover:bg-paper-2">
                Method &amp; limits
              </Link>
            </div>
            <p className="mt-3 text-xs text-muted">Five steps, about five minutes. Runs a real EVM in your browser; no wallet needed.</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 self-center">
            {stats.map((s) => (
              <div key={s.value} className="rounded-xl border border-line bg-card p-4">
                <dt className="num font-display text-2xl font-bold">{s.value}</dt>
                <dd className="mt-1 text-sm text-ink-2">{s.label}</dd>
                <dd className="mt-2 text-[11px] text-muted">{s.source}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-2xl font-bold tracking-tight">The problem a Turkish mill has this year</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-line bg-card p-5">
            <h3 className="font-semibold">Defaults punish clean producers</h3>
            <p className="mt-2 text-sm text-ink-2">
              About 70 % of Türkiye&apos;s steel comes from scrap-based electric arc furnaces, yet the default for its hot-rolled coil assumes the
              blast-furnace route. Without verified data a cleaner mill is priced like a dirtier one, and cutting emissions earns its buyers
              nothing.
            </p>
          </article>
          <article className="rounded-xl border border-line bg-card p-5">
            <h3 className="font-semibold">Verified data does not travel well</h3>
            <p className="mt-2 text-sm text-ink-2">
              Each importer asks the mill for data separately. Spreadsheets cannot stop the same &ldquo;green&rdquo; tonnes being promised to two
              buyers, or a re-roller passing on cleaner figures than the slabs it bought. Analysts have called most third-country reports wrong.
            </p>
          </article>
          <article className="rounded-xl border border-line bg-card p-5">
            <h3 className="font-semibold">Verification is scarce and data is sensitive</h3>
            <p className="mt-2 text-sm text-ink-2">
              Turkish-accredited verifiers are not yet recognised by the EU, the first EU-accredited ones arrived in autumn 2026, and no mill
              wants to email its energy bills to every customer.
            </p>
          </article>
        </div>
      </section>

      <section className="border-y border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight">How Ingot works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-line bg-paper p-5">
                <span className="flex items-center gap-2 text-sm text-muted">
                  <Icon name={s.icon} className="h-5 w-5 text-ink" /> {i + 1}
                </span>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-2xl font-bold tracking-tight">Four doors the contract keeps shut</h2>
        <p className="mt-2 max-w-3xl text-ink-2">
          A shared ledger can enforce what no single company&apos;s software can: a unique, global count of verified tonnes across every buyer,
          trader and tier of the supply chain. Each rule below is a custom error in the registry, tested and reachable from the demo&apos;s
          &ldquo;Try to cheat&rdquo; buttons.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {doors.map((d) => (
            <article key={d.title} className="rounded-xl border border-line bg-card p-5">
              <h3 className="flex items-center gap-2 font-semibold">
                <Icon name="shield" className="h-5 w-5 text-verified" /> {d.title}
              </h3>
              <p className="mt-2 text-sm text-ink-2">{d.body}</p>
              <p className="mt-3 font-mono text-xs text-refused">revert {d.error}(…)</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Why it matters for the climate</h2>
            <p className="mt-3 text-ink-2">
              CBAM only cuts emissions if a producer&apos;s real carbon intensity reaches the price its buyers pay. With default values, a mill
              that switches to scrap or cleaner fuel saves its customers nothing. With a verified, portable statement every 0.1 t CO2e/t it cuts
              is worth about €8 per tonne to the EU buyer in 2026, and the full EU carbon price once free allocation ends in 2034.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">What it is not</h2>
            <p className="mt-3 text-ink-2">
              Ingot does not replace the accredited verifier, the site visit, or the EU&apos;s CBAM Registry, which already lets operators upload
              data once. It adds what a registry of reports does not: a single count of verified tonnes as they are split between buyers and
              consumed by downstream mills, checkable by anyone, with the report itself kept private.{" "}
              <Link href="/method" className="underline">
                Limits and assumptions
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
