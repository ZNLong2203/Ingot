import { keccak256, toHex, type Hex } from "viem";
import { actors, type Role } from "@/lib/chain/actors";
import { attestationTypes, hashInputs, precursorEmissions, registryDomain, type Attestation } from "@/lib/chain/eip712";
import { SandboxChain, type ReplayEntry, type SandboxTx } from "@/lib/chain/sandbox";
import { commit } from "@/lib/crypto/disclosure";
import { deserialize, serialize } from "@/lib/json";
import { installation, supplier } from "@/lib/samples/marmara";

/**
 * The demo's world: a sandbox chain with the registry deployed, two
 * verifiers accredited, the smelter and the mill registered, and the
 * smelter's verified pig iron already delivered to the mill. Everything is
 * deterministic (fixed keys, fixed clock), so the same actions produce the
 * same ids in every browser.
 */

export const T0 = Date.UTC(2026, 9, 19, 7, 30, 0) / 1000; // 19 Oct 2026, 10:30 in Türkiye
const STEP = 97; // seconds the sandbox clock moves per write

export const ids = {
  mill: keccak256(toHex(installation.key)),
  smelter: keccak256(toHex(supplier.key)),
};

export const shipmentRef = (reference: string) => keccak256(toHex(reference));
export const declarationRef = (reference: string) => keccak256(toHex(reference));
export const reasonHash = (text: string) => keccak256(toHex(text));

export const unix = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 1000;

export async function sign(chain: SandboxChain, role: Role, a: Attestation): Promise<Hex> {
  return actors[role].account.signTypedData({
    domain: registryDomain(chain.chainId, chain.registry),
    types: attestationTypes,
    primaryType: "Attestation",
    message: a,
  });
}

export async function write(chain: SandboxChain, role: Role, functionName: string, args: readonly unknown[]) {
  chain.advance(STEP);
  return chain.write(actors[role].address, functionName as never, args as never);
}

/** The smelter's report fields, committed the same way the mill's are. */
export const smelterReport = {
  installation: supplier.name,
  cnCode: supplier.good.cnCode,
  period: supplier.period.label,
  productionTonnes: supplier.quantityTonnes,
  directKgPerTonne: supplier.directKgPerTonne,
  indirectKgPerTonne: supplier.indirectKgPerTonne,
  route: "Blast furnace, sinter and pellets",
};
export const smelterSeed = keccak256(toHex("demo-gusa-report-seed"));

/** The smelter's signed statement, identical in every browser. */
export function smelterAttestation(): Attestation {
  return {
    installationId: ids.smelter,
    cnCode: supplier.good.cnCode,
    periodStart: unix(supplier.period.from),
    periodEnd: unix(supplier.period.to),
    quantityKg: BigInt(supplier.quantityTonnes) * 1000n,
    directKgPerTonne: supplier.directKgPerTonne,
    indirectKgPerTonne: supplier.indirectKgPerTonne,
    carbonPriceCentsPerTonne: 0,
    evidenceRoot: commit(smelterReport, smelterSeed).root,
    inputsHash: hashInputs([]),
    precursorDirectKg: 0n,
    precursorIndirectKg: 0n,
    deadline: T0 + 30 * 86_400,
  };
}

/** The seeded delivery to the second buyer: the example passport on /verify. */
export const exampleDelivery = { reference: "DN-2026-0577", tonnes: 12_000, index: 1n };

async function seed(chain: SandboxChain) {
  const until = T0 + 2 * 365 * 86_400;
  await write(chain, "authority", "accreditVerifier", [actors.verifier.address, actors.verifier.name, until]);
  await write(chain, "authority", "accreditVerifier", [actors.verifier2.address, actors.verifier2.name, until]);
  await write(chain, "verifier2", "registerInstallation", [ids.smelter, actors.supplier.address, "0x4252", keccak256(toHex(JSON.stringify(supplier)))]);
  await write(chain, "verifier", "registerInstallation", [ids.mill, actors.operator.address, "0x5452", keccak256(toHex(JSON.stringify(installation)))]);

  const a = smelterAttestation();
  const tx = await write(chain, "supplier", "submitStatement", [a, await sign(chain, "verifier2", a), []]);
  const pigId = tx.result as Hex;
  await write(chain, "supplier", "allocate", [pigId, actors.operator.address, BigInt(supplier.deliveredTonnes) * 1000n, shipmentRef(supplier.deliveryNote)]);
  // Another customer's delivery, so the smelter's statement shows more than one buyer.
  await write(chain, "supplier", "allocate", [pigId, actors.importer2.address, BigInt(exampleDelivery.tonnes) * 1000n, shipmentRef(exampleDelivery.reference)]);
}

let world: Promise<SandboxChain> | null = null;
const KEY = "ingot.sandbox.v2";
type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const getVersion = () => version;

function changed(chain: SandboxChain) {
  version++;
  try {
    localStorage.setItem(KEY, serialize({ journal: chain.journal, now: chain.now }));
  } catch {
    // Storage can be unavailable (private mode); the demo still works in memory.
  }
  listeners.forEach((l) => l());
}

async function build(): Promise<SandboxChain> {
  try {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (saved) {
      const { journal, now } = deserialize(saved) as { journal: ReplayEntry[]; now: number };
      const chain = await SandboxChain.replay({ authority: actors.authority.address, startTime: T0, journal });
      chain.advance(now - chain.now);
      return chain;
    }
  } catch {
    // A stale or corrupt journal: start a fresh world.
  }
  const chain = await SandboxChain.create({ authority: actors.authority.address, startTime: T0 });
  await seed(chain);
  return chain;
}

export function getWorld(): Promise<SandboxChain> {
  world ??= build();
  return world;
}

/** Runs a write as one of the actors and tells every subscriber. */
export async function act(role: Role, functionName: string, args: readonly unknown[]): Promise<SandboxTx> {
  const chain = await getWorld();
  const tx = await write(chain, role, functionName, args);
  changed(chain);
  return tx;
}

export async function resetWorld() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  world = null;
  const chain = await getWorld();
  changed(chain);
  return chain;
}

export { precursorEmissions };
