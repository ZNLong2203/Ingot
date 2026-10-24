import type { IconName } from "./Icon";

/** One colour and one icon per actor, used the same way on every page. */
export const roleStyle = {
  mill: { label: "Mill", icon: "factory", text: "text-mill", bg: "bg-mill", soft: "bg-mill-soft", border: "border-mill/40" },
  engine: { label: "Engine", icon: "calc", text: "text-engine", bg: "bg-engine", soft: "bg-engine-soft", border: "border-engine/40" },
  verifier: { label: "Verifier", icon: "stamp", text: "text-verifier", bg: "bg-verifier", soft: "bg-verifier-soft", border: "border-verifier/40" },
  importer: { label: "EU importer", icon: "globe", text: "text-importer", bg: "bg-importer", soft: "bg-importer-soft", border: "border-importer/40" },
  chain: { label: "Ledger", icon: "chain", text: "text-chain", bg: "bg-chain", soft: "bg-chain-soft", border: "border-chain/40" },
} satisfies Record<string, { label: string; icon: IconName; text: string; bg: string; soft: string; border: string }>;

export type RoleKey = keyof typeof roleStyle;

/** Maps the demo's chain actors onto the four colours. */
export function roleOf(actorRole: string): RoleKey {
  if (actorRole === "verifier" || actorRole === "verifier2" || actorRole === "authority") return "verifier";
  if (actorRole === "importer" || actorRole === "importer2") return "importer";
  return "mill";
}
