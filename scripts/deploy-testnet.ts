// Deploys CbamPassportRegistry to an EVM network and replays the demo on it:
// two verifiers, the smelter and the mill, the pig iron delivery, the mill's
// Q3 statement consuming it, two shipments, one declaration, and one refused
// over-allocation mined on purpose so it shows up on the explorer.
//
//   RPC_URL=… DEPLOYER_PRIVATE_KEY=0x… npx tsx scripts/deploy-testnet.ts
//
// The deployer becomes the accreditation authority and funds the demo actors'
// throwaway keys with a little gas. Results go to lib/chain/deployments.json.
import { readFile, writeFile } from "node:fs/promises";
import {
  bytesToHex,
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  http,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { actors, type Role } from "@/lib/chain/actors";
import { attestationTypes, hashInputs, precursorEmissions, registryDomain, type Attestation } from "@/lib/chain/eip712";
import { registryAbi, registryBytecode } from "@/lib/chain/registry-artifact";
import { calculate } from "@/lib/cbam/calculate";
import { sefaActualCoil } from "@/lib/cbam/cost";
import { commit } from "@/lib/crypto/disclosure";
import { demoPqKeys, pqKeyHash } from "@/lib/crypto/pq";
import { deriveLines, referenceExtraction } from "@/lib/demo/derive";
import { reportFields } from "@/lib/demo/flow";
import type { DemoState } from "@/lib/demo/store";
import { declarationRef, exampleDelivery, ids, shipmentRef, smelterAttestation, unix } from "@/lib/demo/world";
import { documents, installation, supplier } from "@/lib/samples/marmara";

const rpc = process.env.RPC_URL;
const key = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
if (!rpc || !key) throw new Error("Set RPC_URL and DEPLOYER_PRIVATE_KEY.");

const probe = createPublicClient({ transport: http(rpc) });
const chainId = await probe.getChainId();
const explorers: Record<number, string> = { 11155111: "https://sepolia.etherscan.io", 84532: "https://sepolia.basescan.org", 80002: "https://amoy.polygonscan.com" };
const chain = defineChain({ id: chainId, name: `chain-${chainId}`, nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } });
const pub = createPublicClient({ chain, transport: http(rpc) });
const deployer = privateKeyToAccount(key);
const wallet = (account = deployer) => createWalletClient({ account, chain, transport: http(rpc) });
const log: { label: string; hash: Hex; status: "success" | "reverted" }[] = [];

async function wait(label: string, hash: Hex) {
  const r = await pub.waitForTransactionReceipt({ hash });
  log.push({ label, hash, status: r.status });
  console.log(`${r.status === "success" ? "✓" : "✗"} ${label}  ${hash}`);
  return r;
}

console.log(`Chain ${chainId}; deployer ${deployer.address} holds ${formatEther(await pub.getBalance({ address: deployer.address }))} ETH`);

const deployHash = await wallet().deployContract({ abi: registryAbi, bytecode: registryBytecode, args: [deployer.address] });
const registry = (await wait("Deploy CbamPassportRegistry", deployHash)).contractAddress as Address;

for (const role of ["verifier", "verifier2", "supplier", "operator", "importer", "importer2"] as Role[]) {
  await wait(`Fund ${actors[role].name}`, await wallet().sendTransaction({ to: actors[role].address, value: parseEther(process.env.GAS_FUND ?? "0.003") }));
}

const call = async (role: Role | "authority", label: string, functionName: string, args: readonly unknown[], gas?: bigint) => {
  const account = role === "authority" ? deployer : actors[role].account;
  const hash = await wallet(account).writeContract({ address: registry, abi: registryAbi, functionName: functionName as never, args: args as never, ...(gas ? { gas } : {}) });
  return wait(label, hash);
};
const result = async (functionName: string, args: readonly unknown[]) =>
  pub.readContract({ address: registry, abi: registryAbi, functionName: functionName as never, args: args as never }) as Promise<never>;
const sign = (role: Role, a: Attestation) =>
  actors[role].account.signTypedData({ domain: registryDomain(chainId, registry), types: attestationTypes, primaryType: "Attestation", message: a });

const now = Number((await pub.getBlock()).timestamp);
const until = now + 2 * 365 * 86_400;
await call("authority", "Accredit Anatolia Verification", "accreditVerifier", [actors.verifier.address, actors.verifier.name, until]);
await call("authority", "Accredit Atlântico Verificação", "accreditVerifier", [actors.verifier2.address, actors.verifier2.name, until]);
await call("authority", "Register Anatolia's ML-DSA-65 key", "setVerifierPqKey", [actors.verifier.address, pqKeyHash(demoPqKeys("verifier").publicKey)]);
await call("authority", "Register Atlântico's ML-DSA-65 key", "setVerifierPqKey", [actors.verifier2.address, pqKeyHash(demoPqKeys("verifier2").publicKey)]);
await call("verifier2", "Register the smelter", "registerInstallation", [ids.smelter, actors.supplier.address, "0x4252", ids.smelter]);
await call("verifier", "Register the mill", "registerInstallation", [ids.mill, actors.operator.address, "0x5452", ids.mill]);

const pig = { ...smelterAttestation(), deadline: now + 30 * 86_400 };
await call("supplier", "Smelter's verified pig iron statement", "submitStatement", [pig, await sign("verifier2", pig), []]);
const pigId = (await result("statementIds", [0n])) as Hex;
await call("supplier", "Pig iron to the mill (DN-2026-0642)", "allocate", [pigId, actors.operator.address, BigInt(supplier.deliveredTonnes) * 1000n, shipmentRef(supplier.deliveryNote)]);
await call("supplier", "Pig iron to another buyer", "allocate", [pigId, actors.importer2.address, BigInt(exampleDelivery.tonnes) * 1000n, shipmentRef(exampleDelivery.reference)]);
const inputId = (await result("allocationIds", [0n])) as Hex;

const state = { step: 0, runs: Object.fromEntries(documents.map((d) => [d.id, { status: "done", source: "reference", extraction: referenceExtraction(d) }])), uploads: [], removed: {}, shipments: [] } as DemoState;
const precursor = { allocationId: inputId, label: "Pig iron", quantityTonnes: supplier.deliveredTonnes, directKgPerTonne: supplier.directKgPerTonne, indirectKgPerTonne: supplier.indirectKgPerTonne };
const r = calculate(deriveLines(state).lines, [precursor]);
const sefa = sefaActualCoil({ year: 2026, crudeSteelT: r.crudeSteelT, hotRolledT: r.hotRolledT, pigIronT: r.pigIronT });
// A random salt seed, as the mill would hold it; keep it if you want to disclose fields later.
const seed = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
const report = commit(reportFields(r, { sefaKgPerTonne2026: Math.round(sefa.sefa * 1000) }), seed);
const pre = precursorEmissions([{ quantityKg: BigInt(supplier.deliveredTonnes) * 1000n, directKgPerTonne: supplier.directKgPerTonne, indirectKgPerTonne: supplier.indirectKgPerTonne }]);
const mill: Attestation = {
  installationId: ids.mill,
  cnCode: installation.good.cnCode,
  periodStart: unix(installation.period.from),
  periodEnd: unix(installation.period.to),
  quantityKg: BigInt(Math.round(r.hotRolledT * 1000)),
  directKgPerTonne: r.directKgPerTonne,
  indirectKgPerTonne: r.indirectKgPerTonne,
  carbonPriceCentsPerTonne: 0,
  evidenceRoot: report.root,
  inputsHash: hashInputs([inputId]),
  precursorDirectKg: pre.directKg,
  precursorIndirectKg: pre.indirectKg,
  deadline: now + 30 * 86_400,
};
await call("operator", "Mill's Q3 2026 coil statement (consumes the pig iron)", "submitStatement", [mill, await sign("verifier", mill), [inputId]]);
const millId = (await result("statementIds", [1n])) as Hex;
await call("operator", "6,000 t to Rhein Metals", "allocate", [millId, actors.importer.address, 6_000_000n, shipmentRef("26TR341000EX000101")]);
await call("operator", "4,500 t to Lombardia Tubi", "allocate", [millId, actors.importer2.address, 4_500_000n, shipmentRef("26TR341000EX000102")]);
const rhein = (await result("allocationIds", [2n])) as Hex;
await call("importer", "Rhein Metals declares its allocation", "declare", [rhein, declarationRef("DE-CBAM-2026-0101")]);
// Sent on purpose with a fixed gas limit, so a public explorer shows the refusal.
// A local node may reject it outright instead of mining it.
try {
  await call("operator", "Refused: sell 170,000 t of the same coil again", "allocate", [millId, actors.importer2.address, 170_000_000n, shipmentRef("26TR341000EX009999")], 120_000n);
} catch (e) {
  const reason = (e as { shortMessage?: string }).shortMessage ?? String(e);
  console.log(`✗ Refused before mining: ${reason.split("\n")[0]}`);
}

const file = "lib/chain/deployments.json";
const existing = JSON.parse(await readFile(file, "utf8").catch(() => '{"deployments":[]}'));
existing.deployments = [
  ...existing.deployments.filter((d: { chainId: number }) => d.chainId !== chainId),
  { chainId, explorer: explorers[chainId] ?? null, registry, deployedAt: new Date().toISOString(), statements: { smelter: pigId, mill: millId }, transactions: log },
];
await writeFile(file, `${JSON.stringify(existing, null, 2)}\n`);
console.log(`\nRegistry ${registry} on chain ${chainId}. Saved to ${file}.`);
