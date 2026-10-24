"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { findDeployment, networks, publicDeployments } from "@/lib/chain/public";
import { SANDBOX_CHAIN_ID } from "@/lib/chain/sandbox";
import { checkPassport, looksLikePassport, type Ledger, type Passport, type PassportCheck } from "@/lib/passport";
import { examplePassport, getWorld, smelterAttestation } from "@/lib/demo/world";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Hash } from "@/components/ui/Hash";
import { Icon } from "@/components/ui/Icon";
import { useLedgerVersion } from "@/components/demo/hooks";

function decode(fragment: string): Passport | null {
  try {
    const b64 = fragment.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}

/** The smelter's delivery to the Italian buyer, seeded in every sandbox. */
async function sandboxExample(): Promise<Passport> {
  const chain = await getWorld();
  return examplePassport({ chainId: chain.chainId, registry: chain.registry, attestation: smelterAttestation(), issuedAt: chain.now });
}

/** The same delivery on the public testnet, issued when the demo was replayed there. */
const publicExample = publicDeployments.find((d) => d.examplePassport && networks[d.chainId]?.rpc);

/** The ledger a passport names: this browser's sandbox, or a public deployment read over RPC. */
async function ledgerFor(p: Passport): Promise<Ledger> {
  if (p.anchor.chainId === SANDBOX_CHAIN_ID) return getWorld();
  const found = findDeployment(p.anchor.chainId, p.anchor.registry);
  if (!found) throw new Error(`This passport is anchored on chain ${p.anchor.chainId} at ${p.anchor.registry}, which this page cannot read.`);
  const name = networks[p.anchor.chainId].name;
  // One read first, so a network failure is not reported as a missing statement.
  await found.ledger.read("isAccredited", [p.anchor.registry]).catch(() => {
    throw new Error(`Could not reach ${name}. Check the connection and try again.`);
  });
  return found.ledger;
}

export function PassportChecker() {
  const version = useLedgerVersion();
  const hash = useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    () => window.location.hash,
    () => "",
  );
  const link = useMemo(() => {
    const m = hash.match(/p=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    const p = decode(m[1]);
    return { passport: looksLikePassport(p) ? p : null };
  }, [hash]);
  const [manual, setManual] = useState<Passport | null>(null);
  const passport = manual ?? link?.passport ?? null;
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ checks: PassportCheck[]; status: string } | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const error = link && !link.passport ? "The link does not contain a readable passport." : inputError;

  useEffect(() => {
    if (!passport) return;
    let live = true;
    ledgerFor(passport)
      .then((chain) => checkPassport(passport, chain))
      .then((r) => live && setResult(r))
      .catch((e) => live && setInputError((e as Error).message));
    return () => {
      live = false;
    };
  }, [passport, version]);

  const ok = result?.checks.every((c) => c.ok);
  const subject = passport?.credentialSubject;
  const net = passport && passport.anchor.chainId !== SANDBOX_CHAIN_ID ? networks[passport.anchor.chainId] : undefined;

  return (
    <div className="space-y-6">
      {!passport && (
        <section className="card space-y-3 p-5">
          <p className="text-sm text-ink-2">
            Paste a passport (JSON), open the link the mill sent with the shipment, or load an example: the smelter&apos;s pig iron delivered to an
            Italian buyer, on this browser&apos;s ledger or on the public testnet.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder='{"@context": ["https://www.w3.org/ns/credentials/v2", …'
            className="w-full rounded-md border border-line-strong bg-paper p-3 font-mono text-xs"
            aria-label="Passport JSON"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                try {
                  const parsed = JSON.parse(text);
                  if (!looksLikePassport(parsed)) throw new Error("shape");
                  setManual(parsed);
                  setInputError(null);
                } catch {
                  setInputError("That is not a passport: it needs credentialSubject, proof.eip712 and anchor.");
                }
              }}
              disabled={!text.trim()}
            >
              <Icon name="shield" /> Check this passport
            </Button>
            <Button tone="secondary" onClick={async () => setManual(await sandboxExample())}>
              Load the example
            </Button>
            {publicExample?.examplePassport && (
              <Button tone="secondary" onClick={() => setManual(publicExample.examplePassport!)}>
                <Icon name="chain" /> Example on {networks[publicExample.chainId].name}
              </Button>
            )}
          </div>
        </section>
      )}
      {error && <p className="rounded-md bg-refused-soft px-3 py-2 text-sm text-refused">{error}</p>}

      {passport && subject && (
        <>
          <section className="card relative grid gap-4 overflow-hidden p-5 pt-6 md:grid-cols-[1fr_auto]">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--mill)] via-[var(--verifier)] to-[var(--importer)]" />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">CBAM embedded-emissions passport</p>
              <h2 className="mt-1 font-display text-xl font-bold">
                {subject.allocation.tonnes.toLocaleString("en-US")} t · {subject.good.description}
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                {subject.installation.name} ({subject.installation.country}) → {subject.allocation.recipientName ?? subject.allocation.recipient} · reference{" "}
                <span className="font-mono">{subject.allocation.reference}</span>
              </p>
              <p className="mt-1 text-sm text-ink-2">
                Production {subject.period.from} to {subject.period.to} · issued by {passport.issuer.name}
              </p>
            </div>
            <div className="text-right">
              <p className="num font-display text-4xl font-extrabold text-verified">{(Number(passport.proof.eip712.message.directKgPerTonne) / 1000).toFixed(3)}</p>
              <p className="text-sm text-ink-2">t CO2e per tonne, direct</p>
              <div className="mt-2">
                {result ? ok ? <Badge tone="verified">valid · {result.status}</Badge> : <Badge tone="refused">does not check out</Badge> : <Badge>checking…</Badge>}
              </div>
            </div>
          </section>

          {result && (
            <section className="card overflow-hidden">
              <h3 className="flex items-center justify-between border-b border-line bg-chain-soft/60 px-5 py-3 font-display text-sm font-semibold">
                <span className="flex items-center gap-2">
                  <Icon name="chain" className="h-4 w-4 text-chain" /> Checked against {net ? `${net.name}, live` : "the ledger"}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs ${ok ? "bg-verified-soft text-verified" : "bg-refused-soft text-refused"}`}>
                  {result.checks.filter((c) => c.ok).length}/{result.checks.length} pass
                </span>
              </h3>
              <ul className="divide-y divide-line">
                {result.checks.map((c) => (
                  <li key={c.title} className="flex items-start gap-3 px-5 py-3 text-sm">
                    <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${c.ok ? "bg-verified" : "bg-refused"}`}>
                      <Icon name={c.ok ? "check" : "cross"} className="h-3 w-3" />
                    </span>
                    <span>
                      <span className="font-medium">{c.title}</span>
                      <span className="block text-xs text-muted">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="grid gap-4 md:grid-cols-2">
            <div className="card p-5 text-sm">
              <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
                <Icon name="chain" className="h-4 w-4 text-chain" /> Anchor
              </h3>
              <dl className="mt-2 space-y-1 text-xs text-ink-2">
                <div>
                  <dt className="inline text-muted">Network: </dt>
                  <dd className="inline">{net ? `${net.name} (public testnet)` : "EVM sandbox in this browser"}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Registry: </dt>
                  <dd className="inline">
                    <Hash value={passport.anchor.registry} />
                    {net && (
                      <a className="ml-2 text-chain underline underline-offset-2" href={`${net.explorer}/address/${passport.anchor.registry}`} target="_blank" rel="noreferrer">
                        explorer ↗
                      </a>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted">Statement: </dt>
                  <dd className="inline">
                    <Hash value={passport.anchor.statementId} />
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted">Allocation: </dt>
                  <dd className="inline">
                    <Hash value={subject.allocation.id} />
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted">Proof: </dt>
                  <dd className="inline">{passport.proof.type}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-muted">
                {net
                  ? `Every check was read live from the registry on ${net.name} through a public RPC node, so it works from any browser.`
                  : "The sandbox ledger lives in your browser, so a passport issued in another browser checks only there. Passports anchored on the public testnet check from anywhere."}
              </p>
            </div>
            <div className="card p-5 text-sm">
              <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
                <Icon name="eye" className="h-4 w-4 text-chain" /> Disclosed fields
              </h3>
              <ul className="mt-2 space-y-1 text-xs">
                {subject.disclosures.map((d) => (
                  <li key={d.key} className="flex justify-between gap-3">
                    <span className="text-ink-2">{d.key}</span>
                    <span className="num rounded-md bg-chain-soft px-1.5 font-semibold text-chain">{d.value}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">Each field carries a salted Merkle proof against the evidence root the verifier signed. Everything else in the report stays private.</p>
            </div>
          </section>

          <div className="flex gap-2">
            <Button
              tone="secondary"
              onClick={() => {
                setManual(null);
                setResult(null);
                window.location.hash = "";
              }}
            >
              Check another
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
