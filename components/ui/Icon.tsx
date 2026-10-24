/** Line icons drawn inline, 1.75 px strokes on a 20 px grid. */
const paths = {
  check: "M4 10.5l4 4 8-9",
  cross: "M5 5l10 10M15 5L5 15",
  warn: "M10 3l8 14H2L10 3zm0 5v4m0 2.5v.5",
  doc: "M5 2.5h7l3.5 3.5v11.5H5zM12 2.5V6h3.5M7.5 10h5M7.5 13h5",
  chain: "M8 12l4-4M7 9.5L5.2 11.3a2.6 2.6 0 003.6 3.6L10.5 13M13 10.5l1.8-1.8a2.6 2.6 0 00-3.6-3.6L9.5 7",
  sign: "M3 15c2-1 3-5 5-5s1 4 3 4 2-3 3-3 1 2 3 2M3 18h14",
  ship: "M2 13l2.5 4h11l2.5-4H2zM5 13V8h10v5M8 8V4h4v4",
  shield: "M10 2.5l6 2.5v4.5c0 4-2.6 6.8-6 8-3.4-1.2-6-4-6-8V5l6-2.5z",
  shieldCheck: "M10 2.5l6 2.5v4.5c0 4-2.6 6.8-6 8-3.4-1.2-6-4-6-8V5l6-2.5zM7 10l2 2 4-4.5",
  spark: "M10 2v4M10 14v4M2 10h4M14 10h4M4.5 4.5l2.5 2.5M13 13l2.5 2.5M4.5 15.5L7 13M13 7l2.5-2.5",
  arrow: "M4 10h12M11 5l5 5-5 5",
  factory: "M2.5 17.5V8l4.5 3V8l4.5 3V4.5h3l1 13H2.5zM6 14.5h1.5M10 14.5h1.5",
  calc: "M4.5 2.5h11v15h-11zM7 5.5h6v2.5H7zM7 11h.5M10 11h.5M13 11h.5M7 14h.5M10 14h.5M13 14h.5",
  stamp: "M7 3.5h6l-1 6h3.5v3h-11v-3H8l-1-6zM4 16.5h12",
  globe: "M10 2.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM2.5 10h15M10 2.5c2.2 2.3 3 4.8 3 7.5s-.8 5.2-3 7.5c-2.2-2.3-3-4.8-3-7.5s.8-5.2 3-7.5z",
  lock: "M5.5 9V7a4.5 4.5 0 019 0v2M4 9h12v8.5H4zM10 12.5v2",
  eye: "M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10zM10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  coins: "M7.5 8.5c3 0 5.5-1 5.5-2.25S10.5 4 7.5 4 2 5 2 6.25 4.5 8.5 7.5 8.5zM2 6.25v3.5c0 1.25 2.5 2.25 5.5 2.25M2 9.75v3.5C2 14.5 4.5 15.5 7.5 15.5M12.5 11c3 0 5.5-1 5.5-2.25S15.5 6.5 12.5 6.5M18 8.75v6.5c0 1.25-2.5 2.25-5.5 2.25S7 16.5 7 15.25v-3.5",
  leaf: "M4 16c0-7 4.5-11.5 12-12-0.5 7.5-5 12-12 12zM4 16l6-6",
  flame: "M10 2.5c.5 3 3.5 4.5 3.5 8.5a3.5 3.5 0 01-7 0c0-1.5.7-2.5 1.5-3.2.2 1.4.9 2.2 1.7 2.2C9 7.5 9 5 10 2.5zM5 13.5a5 5 0 0010 0",
  bolt: "M11 2.5L4.5 11H10l-1 6.5L15.5 9H10l1-6.5z",
  scale: "M10 3v14M4 17h12M10 5l-6 2 6-2 6 2M4 7l-2 5a2.5 2.5 0 004 0l-2-5zM16 7l-2 5a2.5 2.5 0 004 0l-2-5z",
  layers: "M10 2.5l7.5 4-7.5 4-7.5-4 7.5-4zM2.5 10l7.5 4 7.5-4M2.5 13.5l7.5 4 7.5-4",
  info: "M10 2.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM10 9v5M10 6.2v.3",
  play: "M6 4l10 6-10 6V4z",
  reset: "M3.5 10a6.5 6.5 0 106.5-6.5c-2 0-3.7.9-5 2.3M3.5 3v3.5H7",
};

export type IconName = keyof typeof paths;

export function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={paths[name]} />
    </svg>
  );
}
