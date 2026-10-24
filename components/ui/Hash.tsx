"use client";

import { useState } from "react";

/** A shortened hash that copies the full value on click. */
export function Hash({ value, className = "" }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const short = value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
  return (
    <button
      type="button"
      title={copied ? "Copied" : value}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className={`font-mono text-[0.8em] text-ink-2 underline decoration-line-strong decoration-dotted underline-offset-2 hover:text-ink ${className}`}
    >
      {copied ? "copied" : short}
    </button>
  );
}
