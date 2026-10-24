import type { Address, Hex } from "viem";

/** EIP-712 shape of a verifier's attestation; must match ATTESTATION_TYPEHASH in the contract. */
export const attestationTypes = {
  Attestation: [
    { name: "installationId", type: "bytes32" },
    { name: "cnCode", type: "uint32" },
    { name: "periodStart", type: "uint32" },
    { name: "periodEnd", type: "uint32" },
    { name: "quantityKg", type: "uint64" },
    { name: "directKgPerTonne", type: "uint32" },
    { name: "indirectKgPerTonne", type: "uint32" },
    { name: "carbonPriceCentsPerTonne", type: "uint32" },
    { name: "evidenceRoot", type: "bytes32" },
    { name: "deadline", type: "uint40" },
  ],
} as const;

export interface Attestation {
  installationId: Hex;
  cnCode: number;
  periodStart: number;
  periodEnd: number;
  quantityKg: bigint;
  directKgPerTonne: number;
  indirectKgPerTonne: number;
  carbonPriceCentsPerTonne: number;
  evidenceRoot: Hex;
  deadline: number;
}

export function registryDomain(chainId: number, verifyingContract: Address) {
  return { name: "CbamPassportRegistry", version: "1", chainId, verifyingContract } as const;
}
