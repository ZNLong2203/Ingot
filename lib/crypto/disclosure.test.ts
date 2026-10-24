import { keccak256, toHex } from "viem";
import { describe, expect, it } from "vitest";
import { commit, disclose, hashLeaf, verifyDisclosure } from "./disclosure";

const seed = keccak256(toHex("operator secret"));
const fields = {
  directKgPerTonne: 412,
  indirectKgPerTonne: 298,
  naturalGasNm3: 4_210_000,
  electricityMWh: 61_500,
  scrapTonnes: 112_400,
  productionTonnes: 100_000,
  meterCertificate: "EPDK-2025-118",
};

describe("selective disclosure", () => {
  it("proves every field against the root", () => {
    const c = commit(fields, seed);
    for (const key of Object.keys(fields)) expect(verifyDisclosure(c.root, disclose(c, key))).toBe(true);
  });

  it("rejects a changed value, a changed key and a foreign root", () => {
    const c = commit(fields, seed);
    const d = disclose(c, "directKgPerTonne");
    expect(verifyDisclosure(c.root, { ...d, value: "300" })).toBe(false);
    expect(verifyDisclosure(c.root, { ...d, key: "indirectKgPerTonne" })).toBe(false);
    expect(verifyDisclosure(commit({ ...fields, scrapTonnes: 1 }, seed).root, d)).toBe(false);
  });

  it("hides values behind salts, so the same value under another seed hashes differently", () => {
    const a = commit(fields, seed).root;
    const b = commit(fields, keccak256(toHex("another secret"))).root;
    expect(a).not.toBe(b);
  });

  it("handles a single field", () => {
    const c = commit({ only: 1 }, seed);
    const d = disclose(c, "only");
    expect(d.proof).toHaveLength(0);
    expect(c.root).toBe(hashLeaf(d.salt, "only", "1"));
    expect(verifyDisclosure(c.root, d)).toBe(true);
  });
});
