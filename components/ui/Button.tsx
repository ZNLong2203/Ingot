import type { ButtonHTMLAttributes } from "react";

const tones = {
  primary: "bg-ink text-paper hover:bg-ink-2 disabled:bg-line-strong",
  secondary: "border border-line-strong bg-card text-ink hover:bg-paper-2 disabled:text-muted",
  danger: "border border-refused/40 bg-refused-soft text-refused hover:border-refused disabled:opacity-60",
  ghost: "text-ink-2 hover:bg-paper-2 hover:text-ink",
};

export function Button({
  tone = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof tones }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${tones[tone]} ${className}`}
    />
  );
}
