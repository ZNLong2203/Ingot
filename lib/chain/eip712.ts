import { encodeAbiParameters, keccak256, type Address, type Hex } from "viem";

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
    { name: "inputsHash", type: "bytes32" },
    { name: "precursorDirectKg", type: "uint64" },
    { name: "precursorIndirectKg", type: "uint64" },
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
  inputsHash: Hex;
  precursorDirectKg: bigint;
  precursorIndirectKg: bigint;
  deadline: number;
}

/** Hash of the precursor allocation ids, exactly as the registry computes it. */
export function hashInputs(ids: readonly Hex[]): Hex {
  return keccak256(encodeAbiParameters([{ type: "bytes32[]" }], [ids]));
}

/**
 * Embedded emissions carried by precursor allocations, rounded down to whole
 * kilograms in the same order of operations as the registry.
 */
export function precursorEmissions(
  inputs: readonly { quantityKg: bigint; directKgPerTonne: number; indirectKgPerTonne: number }[],
): { directKg: bigint; indirectKg: bigint } {
  let direct = 0n;
  let indirect = 0n;
  for (const i of inputs) {
    direct += i.quantityKg * BigInt(i.directKgPerTonne);
    indirect += i.quantityKg * BigInt(i.indirectKgPerTonne);
  }
  return { directKg: direct / 1000n, indirectKg: indirect / 1000n };
}

export function registryDomain(chainId: number, verifyingContract: Address) {
  return { name: "CbamPassportRegistry", version: "1", chainId, verifyingContract } as const;
}
