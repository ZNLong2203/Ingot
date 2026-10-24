/** A few line icons drawn inline, 1.75 px strokes on a 20 px grid. */
const paths = {
  check: "M4 10.5l4 4 8-9",
  cross: "M5 5l10 10M15 5L5 15",
  warn: "M10 3l8 14H2L10 3zm0 5v4m0 2.5v.5",
  doc: "M5 2.5h7l3.5 3.5v11.5H5zM12 2.5V6h3.5",
  chain: "M8 12l4-4M7 9.5L5.2 11.3a2.6 2.6 0 003.6 3.6L10.5 13M13 10.5l1.8-1.8a2.6 2.6 0 00-3.6-3.6L9.5 7",
  sign: "M3 15c2-1 3-5 5-5s1 4 3 4 2-3 3-3 1 2 3 2M3 18h14",
  ship: "M2 13l2.5 4h11l2.5-4H2zM5 13V8h10v5M8 8V4h4v4",
  shield: "M10 2.5l6 2.5v4.5c0 4-2.6 6.8-6 8-3.4-1.2-6-4-6-8V5l6-2.5z",
  spark: "M10 2v4M10 14v4M2 10h4M14 10h4M4.5 4.5l2.5 2.5M13 13l2.5 2.5M4.5 15.5L7 13M13 7l2.5-2.5",
  arrow: "M4 10h12M11 5l5 5-5 5",
};

export function Icon({ name, className = "h-4 w-4" }: { name: keyof typeof paths; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={paths[name]} />
    </svg>
  );
}
