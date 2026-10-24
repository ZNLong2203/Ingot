import { keccak256, toHex } from "viem";
import { describe, expect, it } from "vitest";
import { actors } from "./actors";
import { attestationTypes, registryDomain, type Attestation } from "./eip712";
import { SandboxChain } from "./sandbox";

const T0 = 1_777_000_000;
const INSTALLATION = keccak256(toHex("TR-KOCAELI-EAF-01"));

async function setup() {
  const chain = await SandboxChain.create({ authority: actors.authority.address, startTime: T0 });
  await chain.write(actors.authority.address, "accreditVerifier", [actors.verifier.address, "Anatolia", T0 + 1e7]);
  await chain.write(actors.verifier.address, "registerInstallation", [
    INSTALLATION,
    actors.operator.address,
    "0x5452",
    keccak256(toHex("record")),
  ]);
  const a: Attestation = {
    installationId: INSTALLATION,
    cnCode: 72083900,
    periodStart: 1_767_225_600,
    periodEnd: 1_775_001_600,
    quantityKg: 5_000_000n,
    directKgPerTonne: 410,
    indirectKgPerTonne: 300,
    carbonPriceCentsPerTonne: 0,
    evidenceRoot: keccak256(toHex("root")),
    deadline: T0 + 86_400,
  };
  const signature = await actors.verifier.account.signTypedData({
    domain: registryDomain(chain.chainId, chain.registry),
    types: attestationTypes,
    primaryType: "Attestation",
    message: a,
  });
  const tx = await chain.write(actors.operator.address, "submitStatement", [a, signature]);
  return { chain, a, signature, tx };
}

describe("SandboxChain", () => {
  it("runs the registry bytecode and accepts a verifier's EIP-712 signature", async () => {
    const { chain, tx } = await setup();
    expect(tx.status).toBe("success");
    expect(tx.events[0].eventName).toBe("StatementAttested");
    const id = await chain.read("statementIds", [0n]);
    expect(tx.result).toBe(id);
    expect(await chain.read("availableKg", [id])).toBe(5_000_000n);
  });

  it("reports a decoded custom error when an allocation goes past the verified quantity", async () => {
    const { chain } = await setup();
    const id = await chain.read("statementIds", [0n]);
    const ok = await chain.write(actors.operator.address, "allocate", [id, actors.importer.address, 4_000_000n, keccak256(toHex("a"))]);
    expect(ok.status).toBe("success");
    const bad = await chain.write(actors.operator.address, "allocate", [id, actors.importer2.address, 2_000_000n, keccak256(toHex("b"))]);
    expect(bad.status).toBe("reverted");
    expect(bad.error).toEqual({ name: "ExceedsVerifiedQuantity", args: [id, 1_000_000n, 2_000_000n] });
    expect(await chain.read("availableKg", [id])).toBe(1_000_000n);
  });

  it("rebuilds the same state from its journal", async () => {
    const { chain } = await setup();
    const id = await chain.read("statementIds", [0n]);
    await chain.write(actors.operator.address, "allocate", [id, actors.importer.address, 1_000_000n, keccak256(toHex("a"))]);
    const copy = await SandboxChain.replay({ authority: actors.authority.address, startTime: T0, journal: chain.journal });
    expect(copy.registry).toBe(chain.registry);
    expect(await copy.read("availableKg", [id])).toBe(4_000_000n);
  });
});
