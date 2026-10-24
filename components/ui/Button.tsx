import type { ButtonHTMLAttributes } from "react";

const tones = {
  primary: "bg-ink text-paper hover:bg-ink-2 disabled:bg-line-strong",
  secondary: "border border-line-strong bg-card text-ink hover:bg-paper-2 disabled:text-muted",
  danger: "border border-refused/40 bg-refused-soft text-refused hover:border-refused disabled:opacity-60",
  ghost: "text-ink-2 hover:bg-paper-2 hover:text-ink",
  mill: "bg-mill text-white shadow-sm hover:brightness-110 disabled:bg-line-strong disabled:shadow-none",
  engine: "bg-engine text-white shadow-sm hover:brightness-110 disabled:bg-line-strong disabled:shadow-none",
  verifier: "bg-verifier text-white shadow-sm hover:brightness-110 disabled:bg-line-strong disabled:shadow-none",
  importer: "bg-importer text-white shadow-sm hover:brightness-110 disabled:bg-line-strong disabled:shadow-none",
  done: "border border-verified/40 bg-verified-soft text-verified",
};

export function Button({
  tone = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof tones }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${tones[tone]} ${className}`}
    />
  );
}
