import { keccak256, toHex } from "viem";
import { describe, expect, it } from "vitest";
import { demoPqKeys, fromBase64, pqKeyHash, pqSign, pqVerify, toBase64 } from "./pq";

describe("post-quantum co-signature", () => {
  const { publicKey, secretKey } = demoPqKeys("verifier");
  const digest = keccak256(toHex("statement"));

  it("verifies an ML-DSA-65 signature over the statement id", () => {
    const sig = pqSign(digest, secretKey);
    expect(sig.length).toBe(3309);
    expect(pqVerify(sig, digest, publicKey)).toBe(true);
    expect(pqVerify(fromBase64(toBase64(sig)), digest, publicKey)).toBe(true);
  });

  it("rejects another digest, another key and a flipped bit", () => {
    const sig = pqSign(digest, secretKey);
    expect(pqVerify(sig, keccak256(toHex("other")), publicKey)).toBe(false);
    expect(pqVerify(sig, digest, demoPqKeys("verifier2").publicKey)).toBe(false);
    const bad = sig.slice();
    bad[100] ^= 1;
    expect(pqVerify(bad, digest, publicKey)).toBe(false);
  });

  it("derives the same key per role, so its hash can be registered", () => {
    expect(pqKeyHash(demoPqKeys("verifier").publicKey)).toBe(pqKeyHash(publicKey));
    expect(pqKeyHash(publicKey)).not.toBe(pqKeyHash(demoPqKeys("verifier2").publicKey));
  });
});
