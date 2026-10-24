import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { roleStyle, type RoleKey } from "./roles";

/** A role chip: coloured icon and name. */
export function RoleChip({ role, children }: { role: RoleKey; children?: ReactNode }) {
  const r = roleStyle[role];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${r.soft} ${r.text}`}>
      <Icon name={r.icon} className="h-3.5 w-3.5" />
      {children ?? r.label}
    </span>
  );
}

/** A round coloured icon. */
export function IconDot({ icon, tone = "chain", size = "md" }: { icon: IconName; tone?: RoleKey | "molten" | "verified" | "refused"; size?: "md" | "lg" }) {
  const cls: Record<string, string> = {
    molten: "bg-molten-soft text-molten",
    verified: "bg-verified-soft text-verified",
    refused: "bg-refused-soft text-refused",
  };
  const c = cls[tone] ?? `${roleStyle[tone as RoleKey].soft} ${roleStyle[tone as RoleKey].text}`;
  const s = size === "lg" ? "h-11 w-11" : "h-9 w-9";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-xl ${s} ${c}`}>
      <Icon name={icon} className={size === "lg" ? "h-6 w-6" : "h-5 w-5"} />
    </span>
  );
}

const calloutTones = {
  success: { box: "border-verified/30 bg-verified-soft", icon: "shieldCheck" as IconName, text: "text-verified" },
  warn: { box: "border-warn/30 bg-warn-soft", icon: "warn" as IconName, text: "text-warn" },
  danger: { box: "border-refused/30 bg-refused-soft", icon: "shield" as IconName, text: "text-refused" },
  info: { box: "border-chain/25 bg-chain-soft", icon: "info" as IconName, text: "text-chain" },
};

/** A highlighted message with an icon and a bold first line. */
export function Callout({ tone, title, children, icon }: { tone: keyof typeof calloutTones; title: ReactNode; children?: ReactNode; icon?: IconName }) {
  const t = calloutTones[tone];
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3 ${t.box}`} role={tone === "danger" ? "alert" : undefined}>
      <Icon name={icon ?? t.icon} className={`mt-0.5 h-5 w-5 shrink-0 ${t.text}`} />
      <div className="min-w-0 text-sm">
        <p className={`font-semibold ${t.text}`}>{title}</p>
        {children && <div className="mt-0.5 text-ink-2">{children}</div>}
      </div>
    </div>
  );
}

/** A big number with its meaning. */
export function Stat({ value, label, tone = "ink", sub }: { value: ReactNode; label: ReactNode; tone?: "ink" | "molten" | "verified" | "chain" | "mill" | "importer"; sub?: ReactNode }) {
  const color = { ink: "text-ink", molten: "text-molten", verified: "text-verified", chain: "text-chain", mill: "text-mill", importer: "text-importer" }[tone];
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`num mt-1 font-display text-3xl font-extrabold tracking-tight ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

/** Long explanations stay one click away. */
export function More({ label = "Why this matters", children }: { label?: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-line bg-card/60 px-4 py-2.5 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-medium text-ink-2 hover:text-ink">
        <Icon name="info" className="h-4 w-4 text-chain" />
        {label}
        <Icon name="arrow" className="ml-auto h-4 w-4 text-muted transition-transform group-open:rotate-90" />
      </summary>
      <div className="mt-2 space-y-2 text-ink-2">{children}</div>
    </details>
  );
}
