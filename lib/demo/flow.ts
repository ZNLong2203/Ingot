import { type Hex } from "viem";
import { actorByAddress, actors } from "@/lib/chain/actors";
import { hashInputs, precursorEmissions, type Attestation } from "@/lib/chain/eip712";
import type { SandboxChain } from "@/lib/chain/sandbox";
import type { PrecursorInput, Result } from "@/lib/cbam/calculate";
import { factors } from "@/lib/cbam/factors";
import { commit, disclose, type Commitment } from "@/lib/crypto/disclosure";
import { installation } from "@/lib/samples/marmara";
import { ids, shipmentRef, unix } from "./world";

/** The steps of the demo that talk to the ledger, shared by the UI and the tests. */

export interface LedgerPrecursor extends PrecursorInput {
  allocationId: Hex;
  statementId: Hex;
  quantityKg: bigint;
  verifierName: string;
  supplierName: string;
  reference: string;
}

/** Open allocations addressed to the mill whose shipment reference is one of the delivery notes read. */
export async function findPrecursors(chain: SandboxChain, deliveryNotes: string[]): Promise<LedgerPrecursor[]> {
  const wanted = new Map(deliveryNotes.map((n) => [shipmentRef(n), n]));
  const count = await chain.read("allocationCount", []);
  const out: LedgerPrecursor[] = [];
  for (let i = 0n; i < count; i++) {
    const id = await chain.read("allocationIds", [i]);
    const al = await chain.read("getAllocation", [id]);
    const reference = wanted.get(al.shipmentRef);
    if (!reference || al.status !== 1 || al.recipient.toLowerCase() !== actors.operator.address.toLowerCase()) continue;
    const up = await chain.read("getStatement", [al.statementId]);
    if (up.revoked) continue;
    const inst = await chain.read("installations", [up.installationId]);
    out.push({
      allocationId: id,
      statementId: al.statementId,
      quantityKg: al.quantityKg,
      quantityTonnes: Number(al.quantityKg) / 1000,
      directKgPerTonne: up.directKgPerTonne,
      indirectKgPerTonne: up.indirectKgPerTonne,
      label: `Pig iron, ${actorByAddress(inst[0])?.name ?? "supplier"} (verified, ${reference})`,
      verifierName: actorByAddress(up.verifier)?.name ?? up.verifier,
      supplierName: actorByAddress(inst[0])?.name ?? inst[0],
      reference,
    });
  }
  return out;
}

/** The report fields the verifier commits to; any one can be disclosed later. */
export function reportFields(r: Result, extra: Record<string, string | number> = {}): Record<string, string | number> {
  const row = (s: string) => r.trace.filter((t) => t.stream === s).reduce((a, t) => a + t.directT, 0);
  return {
    installation: installation.name,
    cnCode: installation.good.cnCode,
    period: installation.period.label,
    route: "E (scrap-based electric arc furnace)",
    hotRolledTonnes: r.hotRolledT,
    crudeSteelTonnes: r.crudeSteelT,
    directKgPerTonne: r.directKgPerTonne,
    indirectKgPerTonne: r.indirectKgPerTonne,
    naturalGasTCO2: Math.round(row("natural_gas")),
    electrodesTCO2: Math.round(row("electrodes")),
    chargeCarbonTCO2: Math.round(row("charge_carbon")),
    carbonatesTCO2: Math.round(row("carbonates")),
    precursorTCO2: Math.round(r.precursorDirectT),
    gridFactor: `${factors.gridEfTurkey.value} t CO2e/MWh`,
    ...extra,
  };
}

export function prepareAttestation(opts: {
  chain: SandboxChain;
  result: Result;
  precursors: LedgerPrecursor[];
  report: Commitment;
  validForDays?: number;
}): Attestation {
  const { result: r } = opts;
  const pre = precursorEmissions(opts.precursors.map((p) => ({ quantityKg: p.quantityKg, directKgPerTonne: p.directKgPerTonne, indirectKgPerTonne: p.indirectKgPerTonne })));
  return {
    installationId: ids.mill,
    cnCode: installation.good.cnCode,
    periodStart: unix(installation.period.from),
    periodEnd: unix(installation.period.to),
    quantityKg: BigInt(Math.round(r.hotRolledT * 1000)),
    directKgPerTonne: r.directKgPerTonne,
    indirectKgPerTonne: r.indirectKgPerTonne,
    carbonPriceCentsPerTonne: 0,
    evidenceRoot: opts.report.root,
    inputsHash: hashInputs(opts.precursors.map((p) => p.allocationId)),
    precursorDirectKg: pre.directKg,
    precursorIndirectKg: pre.indirectKg,
    deadline: opts.chain.now + (opts.validForDays ?? 14) * 86_400,
  };
}

/** Fields an importer gets by default: enough to file, nothing commercially sensitive. */
export const DEFAULT_DISCLOSURES = ["directKgPerTonne", "route", "period", "cnCode"];

export function disclosuresFor(report: Commitment, keys = DEFAULT_DISCLOSURES) {
  return keys.map((k) => disclose(report, k));
}

export { commit };
