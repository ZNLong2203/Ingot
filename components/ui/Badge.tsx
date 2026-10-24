import type { ReactNode } from "react";

const tones = {
  neutral: "bg-paper-2 text-ink-2",
  molten: "bg-molten-soft text-molten",
  verified: "bg-verified-soft text-verified",
  refused: "bg-refused-soft text-refused",
  chain: "bg-chain-soft text-chain",
  warn: "bg-warn-soft text-warn",
};

export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
