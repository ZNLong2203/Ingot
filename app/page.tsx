import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { IconDot, RoleChip } from "@/components/ui/Kit";
import { roleStyle, type RoleKey } from "@/components/ui/roles";
import { site } from "@/lib/site";

const stats: { value: string; label: string; source: string; icon: IconName; tone: string }[] = [
  { value: "€10.8 bn", label: "CBAM goods from Türkiye to the EU in 2025", source: "Eurostat Comext", icon: "globe", tone: "text-engine" },
  { value: "2.671", label: "t CO2e/t: EU default for Turkish hot-rolled coil, 2026", source: "Reg. (EU) 2025/2621", icon: "flame", tone: "text-molten" },
  { value: "0.354", label: "t CO2e/t: the demo mill, verified", source: "Ingot, EU method", icon: "leaf", tone: "text-verified" },
  { value: "−€99", label: "per tonne for the EU importer", source: "Q3 2026 price €82.32", icon: "coins", tone: "text-importer" },
];

const flow: { role: RoleKey; title: string; body: string }[] = [
  { role: "mill", title: "AI reads the evidence", body: "Turkish invoices and reports, every number quoted." },
  { role: "engine", title: "EU method, in code", body: "Mass balance, precursors, benchmarks." },
  { role: "verifier", title: "Verifier signs", body: "Checks, then an EIP-712 signature." },
  { role: "chain", title: "Ledger counts", body: "Each tonne verified, sold and ended once." },
  { role: "importer", title: "Importer declares", body: "Passport checked in seconds." },
];

const doors = [
  { title: "Verified once", body: "No overlapping periods for the same product.", error: "PeriodOverlaps", icon: "stamp" as IconName },
  { title: "Sold once", body: "Never more than the verified tonnes.", error: "ExceedsVerifiedQuantity", icon: "ship" as IconName },
  { title: "Ends once", body: "Declared or consumed, never twice.", error: "AllocationNotOpen", icon: "check" as IconName },
  { title: "No carbon laundering", body: "Precursor carbon is recomputed on chain.", error: "BelowPrecursorEmissions", icon: "layers" as IconName },
];

function PassportVisual() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-grid opacity-70" aria-hidden="true" />
      <div className="card overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[var(--mill)] via-[var(--verifier)] to-[var(--importer)]" />
        <div className="p-5">
          <div className="flex items-center justify-between">
            <RoleChip role="importer">CBAM passport</RoleChip>
            <span className="inline-flex items-center gap-1 rounded-full bg-verified-soft px-2 py-0.5 text-xs font-semibold text-verified">
              <Icon name="shieldCheck" className="h-3.5 w-3.5" /> valid on ledger
            </span>
          </div>
          <p className="mt-4 text-sm text-muted">6,000 t hot-rolled coil · Kocaeli → Duisburg</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-verified-soft p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-verified">Verified</p>
              <p className="num font-display text-3xl font-extrabold text-verified">0.354</p>
              <p className="text-xs text-ink-2">t CO2e per tonne</p>
            </div>
            <div className="rounded-xl bg-molten-soft p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-molten">EU default</p>
              <p className="num font-display text-3xl font-extrabold text-molten line-through decoration-2">2.671</p>
              <p className="text-xs text-ink-2">t CO2e per tonne</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-importer/30 bg-importer-soft px-3 py-2.5">
            <span className="text-sm font-medium text-ink-2">Importer saves on this shipment</span>
            <span className="num font-display text-xl font-extrabold text-importer">€593,717</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
            {["EIP-712 + ML-DSA-65 signed", "Merkle disclosures", "1 precursor verified", "declared once"].map((t) => (
              <span key={t} className="rounded-full bg-paper-2 px-2 py-0.5 text-muted">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main>
      <section className="bg-hero border-b border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card/70 px-3 py-1 text-xs font-medium text-ink-2">
              <span className="h-1.5 w-1.5 rounded-full bg-molten" /> IEEE ClimateChain 2026 · {site.track}
            </span>
            <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
              Every tonne carries its carbon. <span className="text-gradient">Once.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-2">
              Verified CBAM data for steel mills, from Turkish invoices to an EU customs declaration, with a smart contract that stops double
              counting and carbon laundering.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--molten)] to-[#f59e0b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:brightness-110"
              >
                <Icon name="play" /> Try the live demo
              </Link>
              <Link href="#how" className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-card px-5 py-3 text-sm font-semibold hover:bg-paper-2">
                How it works
              </Link>
            </div>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              {["No wallet needed", "Real EVM in your browser", "About 5 minutes"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Icon name="check" className="h-4 w-4 text-verified" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <PassportVisual />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.value} className="card p-5">
              <Icon name={s.icon} className={`h-6 w-6 ${s.tone}`} />
              <dt className={`num mt-3 font-display text-3xl font-extrabold tracking-tight ${s.tone}`}>{s.value}</dt>
              <dd className="mt-1 text-sm text-ink-2">{s.label}</dd>
              <dd className="mt-2 text-[11px] text-muted">{s.source}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: "flame" as IconName, tone: "molten" as const, title: "Defaults punish clean mills", body: "70 % of Turkish steel is scrap-EAF, but the default assumes blast furnaces." },
            { icon: "layers" as IconName, tone: "refused" as const, title: "Data can be counted twice", body: "The same “green” tonnes sold to two buyers; re-rollers passing on cleaner figures." },
            { icon: "lock" as IconName, tone: "verifier" as const, title: "Verifiers are scarce, data is private", body: "Few EU-accredited verifiers yet; no mill wants to email its energy bills." },
          ].map((p) => (
            <article key={p.title} className="card flex gap-4 p-5">
              <IconDot icon={p.icon} tone={p.tone} />
              <div>
                <h3 className="font-semibold">{p.title}</h3>
                <p className="mt-1 text-sm text-ink-2">{p.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl font-bold tracking-tight">How it works</h2>
        <p className="mt-2 text-ink-2">Five steps, five colours. The same colours follow each actor through the demo.</p>
        <ol className="mt-8 grid gap-3 md:grid-cols-5">
          {flow.map((f, i) => {
            const r = roleStyle[f.role];
            return (
              <li key={f.title} className="relative">
                <div className={`card h-full border-t-4 p-4 ${r.border}`} style={{ borderTopColor: `var(--${f.role === "chain" ? "chain" : f.role})` }}>
                  <div className="flex items-center justify-between">
                    <IconDot icon={r.icon} tone={f.role} />
                    <span className="num text-xs font-semibold text-muted">0{i + 1}</span>
                  </div>
                  <h3 className={`mt-3 font-semibold ${r.text}`}>{f.title}</h3>
                  <p className="mt-1 text-sm text-ink-2">{f.body}</p>
                </div>
                {i < flow.length - 1 && (
                  <Icon name="arrow" className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-paper text-line-strong md:block" />
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="border-y border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight">Four doors the contract keeps shut</h2>
              <p className="mt-2 max-w-2xl text-ink-2">Each is a real revert you can trigger with the demo&apos;s red “Try to cheat” buttons.</p>
            </div>
            <Link href="/demo" className="inline-flex items-center gap-1.5 text-sm font-semibold text-molten hover:underline">
              Try to cheat <Icon name="arrow" />
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {doors.map((d) => (
              <article key={d.title} className="rounded-2xl border border-line bg-paper p-5">
                <IconDot icon={d.icon} tone="verified" />
                <h3 className="mt-4 font-semibold">{d.title}</h3>
                <p className="mt-1 text-sm text-ink-2">{d.body}</p>
                <p className="mt-4 inline-flex items-center gap-1 rounded-md bg-refused-soft px-2 py-1 font-mono text-[11px] font-medium text-refused">
                  <Icon name="cross" className="h-3 w-3" /> {d.error}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight">
              Cutting carbon finally <span className="text-verified">pays</span>
            </h2>
            <p className="mt-3 text-ink-2">
              On default values a mill&apos;s emission cuts are worth nothing to its EU buyers. With a verified passport, the EU carbon price
              reaches the furnace.
            </p>
            <Link href="/method" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-chain hover:underline">
              Method, sources and limits <Icon name="arrow" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { v: "€8.23", l: "per tonne, for every 0.1 t CO2e/t the mill cuts", t: "text-verified" },
              { v: "€594k", l: "saved on one 6,000 t shipment in the demo", t: "text-importer" },
              { v: "46–410 kt", l: "CO2e a year avoided in Türkiye, low to high scenario", t: "text-engine" },
            ].map((x) => (
              <div key={x.v} className="card p-5">
                <p className={`num font-display text-3xl font-extrabold ${x.t}`}>{x.v}</p>
                <p className="mt-1 text-sm text-ink-2">{x.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
        <div className="card flex flex-col items-start justify-between gap-4 bg-gradient-to-r from-[var(--mill-soft)] via-[var(--verifier-soft)] to-[var(--importer-soft)] p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold">See it refuse a cheat in five minutes</h2>
            <p className="mt-1 text-sm text-ink-2">Fictional companies, real EU rules, a real contract running in your browser.</p>
          </div>
          <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-paper hover:bg-ink-2">
            <Icon name="play" /> Start the demo
          </Link>
        </div>
      </section>
    </main>
  );
}
