# Security and data integrity assessment

What Ingot protects, against whom, how, and what it leaves to people and processes outside the contract.

## Assets

1. **The count of verified tonnes**: the quantity of a verified statement, how it was split, and where each part ended.
2. **The integrity of a statement**: that the published specific embedded emissions are the ones an accredited verifier signed.
3. **The precursor chain**: that a product carries the embedded emissions of the verified precursors it consumed.
4. **Confidential process data**: energy use, production volumes and input mix behind a statement.
5. **Keys**: the authority's, the verifiers', the operators' and the importers'.

## Actors and trust

| Actor | Trusted for | Not trusted for |
|---|---|---|
| Accreditation authority | Admitting and suspending verifiers | Anything about a statement's content |
| Accredited verifier | The truth of the evidence and of the mill's own emissions | Precursor emissions (recomputed on chain), reuse of tonnes |
| Operator (mill) | Nothing it can change alone | — |
| Importer | Nothing | — |
| AI reader | Reading; every number is quoted and checked | Arithmetic, judgement |

## Threats and controls

| # | Threat | Control | Where |
|---|---|---|---|
| T1 | Operator edits a number after the verifier signed | Statement id is the EIP-712 digest; the signature recovers to another address and the call reverts | `submitStatement`, `NotAccreditedVerifier`; test "refuses a statement whose fields were changed after signing" |
| T2 | Signature reused on another chain or contract | EIP-712 domain separator binds chain id and registry address | `EIP712("CbamPassportRegistry","1")` |
| T3 | Old signature submitted after the verifier lost accreditation | Accreditation checked at submission; signatures carry a deadline | `isAccredited`, `SignatureExpired` |
| T4 | Same production verified twice (two verifiers, overlapping periods) | Non-overlapping periods per installation and CN code | `PeriodOverlaps` |
| T5 | Same signed statement resubmitted after revocation to reset allocations | Statement ids are never reused | `StatementExists` |
| T6 | Same verified tonnes sold to two buyers ("green steel" double claim) | Allocations never exceed verified quantity | `ExceedsVerifiedQuantity`; randomised 60-step test |
| T7 | Two allocations on one customs movement | Shipment reference used once | `ShipmentAlreadyAllocated` |
| T8 | Same allocation declared twice, or by someone else | Single terminal state; recipient check | `AllocationNotOpen`, `NotRecipient` |
| T9 | Downstream mill claims cleaner product than its precursors (carbon laundering, re-rolling) | Contract recomputes precursor emissions from upstream statements and refuses a lower total, even with a valid signature | `PrecursorEmissionsMismatch`, `BelowPrecursorEmissions` |
| T10 | Precursor list swapped after signing | Verifier signs the hash of the input ids | `InputsMismatch` |
| T11 | Precursor reused in two products | Consumed allocations are closed | `AllocationNotOpen` |
| T12 | Precursor from a withdrawn statement | Upstream revocation checked on consumption and declaration | `StatementIsRevoked` |
| T13 | Disclosed field forged in a passport | Field verified against the signed evidence root with a Merkle proof | `verifyDisclosure`, `checkPassport` |
| T14 | Hidden field guessed from its hash | Leaves are salted; salts derive from the operator's secret seed | `lib/crypto/disclosure.ts` |
| T15 | Same invoice counted twice in evidence | Duplicate document numbers detected; copy stamps read by the model | `deriveLines`, Evidence step |
| T16 | Wrong number read by the AI | Verbatim source text for each number; plausibility ranges from cited sources; verifier review before signing | `lib/ai`, `lib/cbam/checks.ts` |
| T17 | Prompt injection in an uploaded document | The model returns schema-constrained data only; nothing it returns is executed or signed without review | `lib/ai/extract.ts` |
| T18 | Abuse of the AI endpoint | Type and size limits, per-address rate limit, no storage of files | `app/api/extract/route.ts` |
| T19 | Secrets committed to the public repository | Pre-commit hook blocks private files, env files, API keys and wallet keys | `scripts/hooks/pre-commit` |

## What the contract cannot do

- **Garbage in.** A forged invoice or a meter that lies is the verifier's to catch on site. The contract makes a verifier's error count once, not disappear.
- **A colluding verifier** can still sign false *own* emissions above the precursor floor. Mitigations: accreditation is time-limited and suspendable (suspension voids future submissions), every statement names its signer publicly, and statements can be withdrawn, which closes their open allocations everywhere at once.
- **Revocation does not cascade.** Downstream statements that already consumed a withdrawn precursor stay recorded; the passport check flags them by walking upstream. A production version would add a re-verification flow.
- **Privacy on a public chain.** Quantities per statement and allocation are visible on a public network. The production design runs the same contract on a permissioned EVM network; on a public chain, quantities could be bucketed or replaced by commitments with zero-knowledge range proofs (future work).
- **Front-running** gives no advantage: allocations and declarations are bound to their caller, and statements to their operator.
- **Key loss.** Losing a verifier key means the authority suspends it and accredits a new one; losing an operator key needs a re-registration flow (not implemented).

## Tests

- 21 contract tests (`contracts/test/`): every refusal above with its arguments, the precursor arithmetic, revocation, and a randomised sequence that checks the available quantity after each of 60 allocations.
- 22 unit tests (`lib/**/*.test.ts`): the engine against hand-computed values, disclosure proofs including forged values and foreign roots, the in-page EVM against the same bytecode, and the full demo flow including a tampered passport.
- A browser walkthrough (`e2e/walkthrough.ts`) that runs every step and every "Try to cheat" refusal in Chrome and fails on any page error.
