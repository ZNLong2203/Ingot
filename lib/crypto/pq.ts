import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { hexToBytes, keccak256, toHex, type Hex } from "viem";

/**
 * Post-quantum co-signatures. A verifier signs the statement id (the EIP-712
 * digest) with ML-DSA-65 (FIPS 204) as well as with its Ethereum key; the
 * registry stores the hash of the ML-DSA public key, so a passport stays
 * checkable even once ECDSA can be forged.
 */

export const PQ_ALGORITHM = "ML-DSA-65 (FIPS 204)";

const keys = new Map<string, { publicKey: Uint8Array; secretKey: Uint8Array }>();

/** Demo keys derive from public strings, like the demo's Ethereum keys: never use them for anything real. */
export function demoPqKeys(role: string) {
  let k = keys.get(role);
  if (!k) {
    k = ml_dsa65.keygen(hexToBytes(keccak256(toHex(`climatechain-demo-pq:${role}`))));
    keys.set(role, k);
  }
  return k;
}

export const pqKeyHash = (publicKey: Uint8Array): Hex => keccak256(publicKey);

export function pqSign(digest: Hex, secretKey: Uint8Array): Uint8Array {
  return ml_dsa65.sign(hexToBytes(digest), secretKey);
}

export function pqVerify(signature: Uint8Array, digest: Hex, publicKey: Uint8Array): boolean {
  try {
    return ml_dsa65.verify(signature, hexToBytes(digest), publicKey);
  } catch {
    return false;
  }
}

export function toBase64(b: Uint8Array): string {
  let s = "";
  b.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s);
}

export function fromBase64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
