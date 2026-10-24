import { hashTypedData, recoverTypedDataAddress } from "viem";
import { describe, expect, it } from "vitest";
import { verifyDisclosure } from "@/lib/crypto/disclosure";
import { demoPqKeys, fromBase64, pqKeyHash, pqVerify } from "@/lib/crypto/pq";
import { fromJson, looksLikePassport } from "@/lib/passport";
import { actors } from "./actors";
import { attestationTypes } from "./eip712";
import { networks, publicDeployments } from "./public";

/** The recorded testnet deployments, checked offline; /verify checks the rest on the network itself. */
describe.each(publicDeployments.filter((d) => d.examplePassport))("deployment on chain $chainId", (d) => {
  const p = d.examplePassport!;

  it("names a network the page can read", () => {
    expect(networks[d.chainId]?.rpc).toMatch(/^https:\/\//);
    expect(p.anchor).toMatchObject({ chainId: d.chainId, registry: d.registry, statementId: d.statements.smelter });
  });

  it("carries a passport the second verifier signed for that registry", async () => {
    expect(looksLikePassport(p)).toBe(true);
    const { domain } = p.proof.eip712;
    const message = fromJson(p.proof.eip712.message);
    expect(domain).toMatchObject({ chainId: d.chainId, verifyingContract: d.registry });
    expect(hashTypedData({ domain, types: attestationTypes, primaryType: "Attestation", message })).toBe(d.statements.smelter);
    const signer = await recoverTypedDataAddress({ domain, types: attestationTypes, primaryType: "Attestation", message, signature: p.proof.proofValue });
    expect(signer).toBe(actors.verifier2.address);
  });

  it("co-signs with the verifier's post-quantum key and discloses against the signed root", () => {
    const pk = fromBase64(p.proof.pq!.publicKey);
    expect(pqKeyHash(pk)).toBe(pqKeyHash(demoPqKeys("verifier2").publicKey));
    expect(pqVerify(fromBase64(p.proof.pq!.proofValue), d.statements.smelter, pk)).toBe(true);
    const root = p.proof.eip712.message.evidenceRoot;
    expect(p.credentialSubject.disclosures.length).toBeGreaterThan(0);
    expect(p.credentialSubject.disclosures.every((x) => verifyDisclosure(root, x))).toBe(true);
  });
});
