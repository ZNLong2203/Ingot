/** A trapezoid ingot with one bright seam: a tonne, stamped once. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path d="M7 11h18l4 12H3z" fill="currentColor" />
      <path d="M9 15h14" stroke="var(--molten)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
