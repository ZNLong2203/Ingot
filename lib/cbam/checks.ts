import type { ActivityLine, Result } from "./calculate";
import { gasNetTj } from "./calculate";

/**
 * Plausibility checks a verifier would run before signing. They do not
 * replace a site visit; they point at the numbers worth a second look.
 * Ranges are wide on purpose and each carries its source.
 */

export interface Range {
  min: number;
  max: number;
  unit: string;
  source: string;
}

export const ranges = {
  electricity: { min: 350, max: 750, unit: "kWh / t crude steel (whole site)", source: "EU BAT reference document for iron and steel (2013), EAF and rolling" },
  electrodes: { min: 0.9, max: 3.5, unit: "kg / t crude steel", source: "EU BAT reference document for iron and steel (2013), EAF" },
  gas: { min: 0.8, max: 2.2, unit: "GJ (NCV) / t hot-rolled", source: "EU BAT reference document for iron and steel (2013), reheating furnaces" },
  metallic: { min: 1.05, max: 1.2, unit: "t metallic charge / t crude steel", source: "Typical EAF metallic yield" },
  yield: { min: 0.9, max: 0.995, unit: "t hot-rolled / t crude steel", source: "Typical hot strip mill yield" },
} satisfies Record<string, Range>;

export type CheckStatus = "pass" | "warn" | "fail";

export interface Check {
  id: string;
  group: "Evidence" | "Physics" | "Ledger";
  title: string;
  status: CheckStatus;
  detail: string;
  value?: string;
  range?: Range;
}

const sum = (ls: ActivityLine[]) => ls.reduce((s, l) => s + l.quantity, 0);

function inRange(id: string, title: string, value: number, range: Range, group: Check["group"] = "Physics"): Check {
  const ok = value >= range.min && value <= range.max;
  return {
    id,
    group,
    title,
    status: ok ? "pass" : "warn",
    value: `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${range.unit}`,
    range,
    detail: ok
      ? `Inside the expected ${range.min}–${range.max} ${range.unit}.`
      : `Outside the expected ${range.min}–${range.max} ${range.unit}. Ask for meter records before signing.`,
  };
}

export function runChecks(opts: {
  lines: ActivityLine[];
  result: Result;
  duplicates: { kept: string; dropped: string; number: string }[];
  months: readonly string[];
  precursorMatched: boolean;
}): Check[] {
  const { result } = opts;
  const lines = opts.lines.filter((l) => !l.excluded);
  const by = (s: ActivityLine["stream"]) => lines.filter((l) => l.stream === s);
  const checks: Check[] = [];

  checks.push({
    id: "duplicates",
    group: "Evidence",
    title: "Each document counted once",
    status: opts.duplicates.length ? "warn" : "pass",
    detail: opts.duplicates.length
      ? opts.duplicates.map((d) => `"${d.dropped}" repeats ${d.number} from "${d.kept}"; it was left out.`).join(" ")
      : "No two documents share a number.",
  });

  const required: ActivityLine["stream"][] = ["natural_gas", "electricity", "crude_steel", "hot_rolled", "electrodes", "charge_carbon", "carbonates"];
  const gaps = required.flatMap((s) => opts.months.filter((m) => !by(s).some((l) => l.month === m)).map((m) => `${s.replace("_", " ")} ${m}`));
  checks.push({
    id: "coverage",
    group: "Evidence",
    title: "Every month of every source stream is covered",
    status: gaps.length ? "fail" : "pass",
    detail: gaps.length ? `Missing: ${gaps.join(", ")}.` : `${required.length} streams × ${opts.months.length} months, no gaps.`,
  });

  const unquoted = lines.filter((l) => !l.sourceText?.trim());
  checks.push({
    id: "quoted",
    group: "Evidence",
    title: "Every number points to its source text",
    status: unquoted.length ? "warn" : "pass",
    detail: unquoted.length ? `${unquoted.length} lines have no quoted source.` : `${lines.length} lines, each with the text it was read from.`,
  });

  const crude = result.crudeSteelT;
  if (crude > 0) {
    const mwh = by("electricity").reduce((s, l) => s + (l.unit === "kWh" ? l.quantity / 1000 : l.quantity), 0);
    checks.push(inRange("electricity", "Electricity per tonne of crude steel", (mwh * 1000) / crude, ranges.electricity));
    checks.push(inRange("electrodes", "Electrode consumption", (sum(by("electrodes")) * 1000) / crude, ranges.electrodes));
    checks.push(inRange("metallic", "Metallic charge per tonne of crude steel", (sum(by("scrap")) + sum(by("pig_iron"))) / crude, ranges.metallic));
  }
  if (result.hotRolledT > 0) {
    const gj = by("natural_gas").reduce((s, l) => s + gasNetTj(l), 0) * 1000;
    checks.push(inRange("gas", "Reheating fuel per tonne rolled", gj / result.hotRolledT, ranges.gas));
    if (crude > 0) {
      const y = result.hotRolledT / crude;
      const c = inRange("yield", "Rolling yield", y, ranges.yield);
      if (y > 1) {
        c.status = "fail";
        c.detail = "More steel left the mill than was cast. Purchased slabs may be missing as a precursor, or output is overstated.";
      }
      checks.push(c);
    }
  }

  checks.push({
    id: "precursor",
    group: "Ledger",
    title: "Pig iron is covered by a verified allocation",
    status: opts.precursorMatched ? "pass" : "fail",
    detail: opts.precursorMatched
      ? "The delivery note number matches an open allocation addressed to this mill; its emissions come from the smelter's verified statement."
      : "No open allocation on the ledger matches the pig iron charged. Its emissions would have to use the default value.",
  });

  return checks;
}
