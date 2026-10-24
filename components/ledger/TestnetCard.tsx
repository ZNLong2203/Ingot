import deployments from "@/lib/chain/deployments.json";
import { Icon } from "@/components/ui/Icon";

interface Deployment {
  chainId: number;
  explorer: string | null;
  registry: string;
  deployedAt: string;
  transactions: { label: string; hash: string; status: string }[];
}

const NAMES: Record<number, string> = { 11155111: "Ethereum Sepolia", 84532: "Base Sepolia", 80002: "Polygon Amoy" };

/** The same contract on a public testnet, when scripts/deploy-testnet.ts has been run. */
export function TestnetCard() {
  const list = (deployments.deployments as Deployment[]).filter((d) => d.explorer);
  if (!list.length) return null;
  return (
    <section className="mb-8 space-y-4">
      {list.map((d) => (
        <div key={d.chainId} className="rounded-xl border border-chain/30 bg-chain-soft/40 p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Icon name="chain" className="h-5 w-5 text-chain" /> Also deployed on {NAMES[d.chainId] ?? `chain ${d.chainId}`}
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Registry{" "}
            <a className="font-mono underline" href={`${d.explorer}/address/${d.registry}`}>
              {d.registry}
            </a>{" "}
            · the demo replayed on {d.deployedAt.slice(0, 10)}
          </p>
          <ol className="mt-3 grid gap-1 text-xs sm:grid-cols-2">
            {d.transactions.map((t) => (
              <li key={t.hash}>
                <a className="underline decoration-line-strong underline-offset-2 hover:text-ink" href={`${d.explorer}/tx/${t.hash}`}>
                  {t.status === "success" ? "✓" : "✗"} {t.label}
                </a>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
