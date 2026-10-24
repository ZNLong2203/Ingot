import Link from "next/link";
import { networks, publicDeployments } from "@/lib/chain/public";
import { Icon } from "@/components/ui/Icon";

/** The same contract on a public testnet, when scripts/deploy-testnet.ts has been run. */
export function TestnetCard() {
  const list = publicDeployments.filter((d) => d.explorer);
  if (!list.length) return null;
  return (
    <section className="mb-8 space-y-4">
      {list.map((d) => (
        <div key={d.chainId} className="rounded-xl border border-chain/30 bg-chain-soft/40 p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Icon name="chain" className="h-5 w-5 text-chain" /> Also live on {networks[d.chainId]?.name ?? `chain ${d.chainId}`}
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Registry{" "}
            <a className="font-mono underline" href={`${d.explorer}/address/${d.registry}`} target="_blank" rel="noreferrer">
              {d.registry}
            </a>{" "}
            · the demo replayed on {d.deployedAt.slice(0, 10)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {d.source && (
              <a className="rounded-full bg-verified-soft px-2.5 py-1 font-medium text-verified hover:underline" href={d.source} target="_blank" rel="noreferrer">
                ✓ Source code verified ↗
              </a>
            )}
            {d.examplePassport && (
              <Link className="rounded-full bg-chain-soft px-2.5 py-1 font-medium text-chain hover:underline" href="/verify">
                Check a passport anchored here →
              </Link>
            )}
          </div>
          <ol className="mt-3 gap-8 text-xs sm:columns-2">
            {d.transactions.map((t) => (
              <li key={t.hash} className="mb-1 break-inside-avoid">
                <a
                  className={`underline decoration-line-strong underline-offset-2 hover:text-ink ${t.status === "success" ? "" : "font-medium text-refused"}`}
                  href={`${d.explorer}/tx/${t.hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
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
