import { actorByAddress } from "@/lib/chain/actors";
import type { SandboxTx } from "@/lib/chain/sandbox";

/** Plain-language lines for the ledger feed. */

const t = (kg: unknown) => `${(Number(kg) / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })} t`;
const who = (a: unknown) => actorByAddress(String(a))?.name ?? `${String(a).slice(0, 8)}…`;
/** Ends a sentence with one full stop, even after "Ltd." or "S.p.A.". */
const end = (s: string) => (s.endsWith(".") ? s : `${s}.`);

const calls: Record<string, string> = {
  accreditVerifier: "Accredit a verifier",
  suspendVerifier: "Suspend a verifier",
  setVerifierPqKey: "Register a post-quantum key",
  registerInstallation: "Register an installation",
  submitStatement: "Record a verified statement",
  revokeStatement: "Withdraw a statement",
  allocate: "Allocate tonnes to a shipment",
  declare: "Surrender in a CBAM declaration",
};

export function callLabel(fn: string) {
  return calls[fn] ?? fn;
}

export function refusal(name: string, args: readonly unknown[]): string {
  switch (name) {
    case "ExceedsVerifiedQuantity":
      return `Only ${t(args[1])} of this statement are left; ${t(args[2])} were asked for. The same tonnes cannot be sold twice.`;
    case "ShipmentAlreadyAllocated":
      return "This customs reference already carries an allocation.";
    case "AllocationNotOpen":
      return `This allocation was already ${["", "open", "declared", "consumed"][Number(args[1])] ?? "used"}. It can end only once.`;
    case "NotRecipient":
      return `${who(args[1])} is not the recipient of this allocation.`;
    case "NotOperator":
      return `${who(args[1])} does not operate this installation.`;
    case "NotAccreditedVerifier":
      return `The signature recovers to ${who(args[0])}, which is not an accredited verifier. Any change after signing breaks the signature.`;
    case "PeriodOverlaps":
      return "A verified statement already covers this period for this product. A tonne is verified once.";
    case "BelowPrecursorEmissions":
      return `The product would carry ${t(args[0])} CO2e, less than the ${t(args[1])} CO2e in the precursors it consumed. Carbon cannot be laundered downstream.`;
    case "PrecursorEmissionsMismatch":
      return `Precursor emissions must be ${t(args[2])} CO2e, recomputed from the upstream statements; ${t(args[0])} were claimed.`;
    case "InputsMismatch":
      return "The precursor list differs from the one the verifier signed.";
    case "StatementIsRevoked":
      return "The statement was withdrawn; nothing more can be allocated, consumed or declared from it.";
    case "SignatureExpired":
      return "The verifier's signature has expired.";
    case "StatementExists":
      return "This exact signed statement was recorded before.";
    case "BelowPrecursorIndirectEmissions":
      return `The product would carry ${t(args[0])} CO2e of indirect emissions, less than the ${t(args[1])} in its precursors.`;
    case "SelfAttestation":
      return "A verifier cannot sign for an installation it operates.";
    case "FuturePeriod":
      return "Only finished production periods can be verified.";
    case "ZeroAddress":
      return "An empty address is not allowed here.";
    default:
      return name;
  }
}

export function describe(tx: SandboxTx): { title: string; detail: string } {
  const title = callLabel(tx.functionName);
  if (tx.status === "reverted") return { title, detail: tx.error ? refusal(tx.error.name, tx.error.args) : "Reverted" };
  const ev = Object.fromEntries(tx.events.map((e) => [e.eventName, e.args]));
  if (ev.StatementAttested) {
    const a = ev.StatementAttested;
    const consumed = tx.events.filter((e) => e.eventName === "Consumed").length;
    return {
      title,
      detail: end(`${t(a.quantityKg)} of CN ${a.cnCode} at ${Number(a.directKgPerTonne) / 1000} t CO2e/t, signed by ${who(a.verifier)}${consumed ? `; consumed ${consumed} precursor allocation${consumed > 1 ? "s" : ""}` : ""}`),
    };
  }
  if (ev.Allocated) return { title, detail: end(`${t(ev.Allocated.quantityKg)} to ${who(ev.Allocated.recipient)}`) };
  if (ev.Declared) return { title, detail: `${who(ev.Declared.declarant)} surrendered the allocation.` };
  if (ev.VerifierAccredited) return { title, detail: end(String(ev.VerifierAccredited.name)) };
  if (ev.VerifierPqKeySet) return { title, detail: end(`ML-DSA-65 key hash for ${who(ev.VerifierPqKeySet.verifier)}`) };
  if (ev.InstallationRegistered) return { title, detail: end(`${who(ev.InstallationRegistered.operator)}, registered by ${who(ev.InstallationRegistered.registeredBy)}`) };
  if (ev.StatementRevoked) return { title, detail: end(`By ${who(ev.StatementRevoked.by)}`) };
  return { title, detail: "" };
}
