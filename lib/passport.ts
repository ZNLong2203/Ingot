import { hashTypedData, recoverTypedDataAddress, type Address, type Hex } from "viem";
import { actorByAddress } from "@/lib/chain/actors";
import { attestationTypes, registryDomain, type Attestation } from "@/lib/chain/eip712";
import type { SandboxChain } from "@/lib/chain/sandbox";
import { verifyDisclosure, type Disclosure } from "@/lib/crypto/disclosure";

/**
 * A CBAM emissions passport: what an importer receives with a shipment. It
 * is shaped as a W3C Verifiable Credential whose proof is the verifier's
 * EIP-712 signature, and it names the ledger entry that anchors it.
 */

export interface Passport {
  "@context": string[];
  type: string[];
  id: string;
  issuer: { id: string; name: string };
  validFrom: string;
  credentialSubject: {
    installation: { id: Hex; name: string; country: string };
    good: { cnCode: number; description: string };
    period: { from: string; to: string };
    embeddedEmissions: { directPerTonne: number; indirectPerTonne: number; unit: string; chargeable: string };
    allocation: { id: Hex; tonnes: number; recipient: Address; recipientName?: string; shipmentRef: Hex; reference: string };
    disclosures: Disclosure[];
  };
  proof: {
    type: "EthereumEip712Signature2021";
    created: string;
    proofPurpose: "assertionMethod";
    verificationMethod: string;
    proofValue: Hex;
    eip712: { domain: ReturnType<typeof registryDomain>; primaryType: "Attestation"; message: JsonAttestation };
  };
  anchor: { network: "sandbox" | "sepolia"; chainId: number; registry: Address; statementId: Hex };
}

/** The attestation as JSON: 64-bit fields travel as decimal strings. */
export type JsonAttestation = Omit<Attestation, "quantityKg" | "precursorDirectKg" | "precursorIndirectKg"> & {
  quantityKg: string;
  precursorDirectKg: string;
  precursorIndirectKg: string;
};

export function toJson(a: Attestation): JsonAttestation {
  return { ...a, quantityKg: a.quantityKg.toString(), precursorDirectKg: a.precursorDirectKg.toString(), precursorIndirectKg: a.precursorIndirectKg.toString() };
}

export function fromJson(a: JsonAttestation): Attestation {
  return { ...a, quantityKg: BigInt(a.quantityKg), precursorDirectKg: BigInt(a.precursorDirectKg), precursorIndirectKg: BigInt(a.precursorIndirectKg) };
}

const did = (chainId: number, a: Address) => `did:pkh:eip155:${chainId}:${a}`;

export function buildPassport(opts: {
  chain: SandboxChain;
  attestation: Attestation;
  signature: Hex;
  verifier: Address;
  statementId: Hex;
  installation: { name: string; country: string };
  good: { cnCode: number; description: string };
  period: { from: string; to: string };
  allocation: { id: Hex; tonnes: number; recipient: Address; shipmentRef: Hex; reference: string };
  disclosures: Disclosure[];
  issuedAt: number;
}): Passport {
  const { chain, attestation: a } = opts;
  const created = new Date(opts.issuedAt * 1000).toISOString();
  return {
    "@context": ["https://www.w3.org/ns/credentials/v2", "https://ingot.example/contexts/cbam-passport/v1"],
    type: ["VerifiableCredential", "CbamEmbeddedEmissionsPassport"],
    id: `urn:ingot:allocation:${opts.allocation.id}`,
    issuer: { id: did(chain.chainId, opts.verifier), name: actorByAddress(opts.verifier)?.name ?? "Verifier" },
    validFrom: created,
    credentialSubject: {
      installation: { id: a.installationId, ...opts.installation },
      good: opts.good,
      period: opts.period,
      embeddedEmissions: {
        directPerTonne: a.directKgPerTonne / 1000,
        indirectPerTonne: a.indirectKgPerTonne / 1000,
        unit: "t CO2e per tonne of good",
        chargeable: "direct (iron and steel, Annex II of Regulation (EU) 2023/956)",
      },
      allocation: { ...opts.allocation, recipientName: actorByAddress(opts.allocation.recipient)?.name },
      disclosures: opts.disclosures,
    },
    proof: {
      type: "EthereumEip712Signature2021",
      created,
      proofPurpose: "assertionMethod",
      verificationMethod: `${did(chain.chainId, opts.verifier)}#blockchainAccountId`,
      proofValue: opts.signature,
      eip712: { domain: registryDomain(chain.chainId, chain.registry), primaryType: "Attestation", message: toJson(a) },
    },
    anchor: { network: "sandbox", chainId: chain.chainId, registry: chain.registry, statementId: opts.statementId },
  };
}

export interface PassportCheck {
  title: string;
  ok: boolean;
  detail: string;
}

const STATUS = ["none", "open", "declared", "consumed"] as const;

/** Checks a passport against the ledger it names. */
/** True when the object has the parts a passport check needs. */
export function looksLikePassport(x: unknown): x is Passport {
  const p = x as Passport;
  return Boolean(p?.proof?.eip712?.message && p?.proof?.proofValue && p?.credentialSubject?.allocation && p?.credentialSubject?.embeddedEmissions && p?.anchor?.statementId);
}

export async function checkPassport(p: Passport, chain: SandboxChain): Promise<{ checks: PassportCheck[]; status: string }> {
  const checks: PassportCheck[] = [];
  const { domain } = p.proof.eip712;
  let message: Attestation;
  try {
    message = fromJson(p.proof.eip712.message);
  } catch {
    return { checks: [{ title: "Readable passport", ok: false, detail: "The signed fields are malformed." }], status: "unknown" };
  }
  const sameChain = domain.chainId === chain.chainId && domain.verifyingContract.toLowerCase() === chain.registry.toLowerCase();
  checks.push({
    title: "Issued for this registry",
    ok: sameChain,
    detail: sameChain ? `Chain ${domain.chainId}, registry ${short(domain.verifyingContract)}.` : "The signature's domain names another chain or contract.",
  });

  const digest = hashTypedData({ domain, types: attestationTypes, primaryType: "Attestation", message });
  const idOk = digest.toLowerCase() === p.anchor.statementId.toLowerCase();
  checks.push({
    title: "Statement id is the hash of what the verifier signed",
    ok: idOk,
    detail: idOk ? short(digest) : "The passport's fields do not hash to its statement id.",
  });

  // Everything shown to the reader must come from what was signed, not from free text.
  const subj = p.credentialSubject;
  const day = (s: number) => new Date(s * 1000).toISOString().slice(0, 10);
  const mismatches = [
    subj.embeddedEmissions.directPerTonne !== message.directKgPerTonne / 1000 && "direct emissions",
    subj.embeddedEmissions.indirectPerTonne !== message.indirectKgPerTonne / 1000 && "indirect emissions",
    subj.installation.id.toLowerCase() !== message.installationId.toLowerCase() && "installation",
    subj.good.cnCode !== message.cnCode && "CN code",
    (subj.period.from !== day(message.periodStart) || subj.period.to !== day(message.periodEnd)) && "period",
  ].filter(Boolean);
  checks.push({
    title: "Displayed figures are the signed ones",
    ok: mismatches.length === 0,
    detail: mismatches.length ? `Edited after signing: ${mismatches.join(", ")}.` : "Emissions, installation, CN code and period match the signature.",
  });

  const signer = await recoverTypedDataAddress({ domain, types: attestationTypes, primaryType: "Attestation", message, signature: p.proof.proofValue }).catch(() => null);
  let statement: Awaited<ReturnType<typeof readStatement>> | null = null;
  try {
    statement = await readStatement(chain, p.anchor.statementId);
  } catch {
    statement = null;
  }
  checks.push({
    title: "Anchored on the ledger",
    ok: Boolean(statement),
    detail: statement ? `Recorded at ${new Date(statement.attestedAt * 1000).toUTCString()}.` : "No such statement on this ledger.",
  });
  // The registry only records statements whose signer was accredited at the time.
  const accredited = signer ? await chain.read("isAccredited", [signer]) : false;
  const sameSigner = Boolean(signer && statement && signer.toLowerCase() === statement.verifier.toLowerCase());
  checks.push({
    title: "Signed by the accredited verifier on record",
    ok: sameSigner,
    detail: signer
      ? `${actorByAddress(signer)?.name ?? short(signer)}; accredited when recorded${accredited ? ", still accredited" : ", since suspended or expired"}.`
      : "The signature does not recover.",
  });
  if (statement) {
    checks.push({
      title: "Not revoked",
      ok: !statement.revoked,
      detail: statement.revoked ? "The verifier or the authority withdrew this statement." : "Statement is live.",
    });
  }

  let status = "unknown";
  try {
    const al = await chain.read("getAllocation", [p.credentialSubject.allocation.id]);
    status = STATUS[al.status] ?? "unknown";
    const matches =
      al.statementId.toLowerCase() === p.anchor.statementId.toLowerCase() &&
      al.recipient.toLowerCase() === p.credentialSubject.allocation.recipient.toLowerCase() &&
      al.shipmentRef.toLowerCase() === p.credentialSubject.allocation.shipmentRef.toLowerCase() &&
      al.quantityKg === BigInt(Math.round(p.credentialSubject.allocation.tonnes * 1000));
    checks.push({
      title: "Allocation matches: statement, recipient, shipment, tonnes",
      ok: matches,
      detail: matches ? `${p.credentialSubject.allocation.tonnes.toLocaleString("en-US")} t to ${p.credentialSubject.allocation.recipientName ?? short(al.recipient)}, ${status}.` : "The ledger's allocation differs from the passport.",
    });
  } catch {
    checks.push({ title: "Allocation matches: statement, recipient, shipment, tonnes", ok: false, detail: "No such allocation on this ledger." });
  }

  if (statement) {
    const inputs = await chain.read("getStatementInputs", [p.anchor.statementId]);
    let upstreamOk = true;
    const names: string[] = [];
    for (const id of inputs) {
      const al = await chain.read("getAllocation", [id]);
      const up = await chain.read("getStatement", [al.statementId]);
      if (up.revoked) upstreamOk = false;
      names.push(`${(Number(al.quantityKg) / 1000).toLocaleString("en-US")} t at ${up.directKgPerTonne / 1000} t CO2e/t`);
    }
    checks.push({
      title: "Precursors are verified and live",
      ok: upstreamOk,
      detail: inputs.length ? `${inputs.length} consumed: ${names.join("; ")}.` : "No CBAM precursors.",
    });
    const disclosures = p.credentialSubject.disclosures;
    const disclosedOk = disclosures.every((d) => verifyDisclosure(statement!.evidenceRoot, d));
    checks.push({
      title: "Disclosed report fields match the evidence root",
      ok: disclosedOk,
      detail: disclosures.length ? disclosures.map((d) => `${d.key} = ${d.value}`).join(", ") : "Nothing disclosed.",
    });
  }
  return { checks, status };
}

async function readStatement(chain: SandboxChain, id: Hex) {
  return chain.read("getStatement", [id]);
}

export const short = (h: string) => (h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h);
