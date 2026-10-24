# Testing

| Suite | Command | What it proves |
|---|---|---|
| Contract | `npm run contracts:test` | 30 tests on Hardhat's simulated network with viem: each refusal with its arguments (overlapping periods, tampered fields, unaccredited or suspended signers, over-allocation, reused shipment, double declaration, foreign recipient, revoked statements), the precursor rules (recomputed emissions, laundering floor, swapped inputs, reuse, revoked upstream), selective disclosure verified on chain against the app's own Merkle code, the correction path (periods reopened in either withdrawal order, precursors returned, customs references freed), the guards (self-attestation, future periods, empty addresses), and a 60-step randomised allocation sequence that checks the available quantity after every step. |
| Unit | `npm test` | 28 tests with Vitest: the engine against hand-computed values for every source stream, the recursive free allocation adjustment, default-value pricing and mark-ups, disclosure proofs (forged value, forged key, foreign root, single leaf), the in-page EVM running the same bytecode (EIP-712 signature, decoded custom errors, journal replay), and the whole demo flow from documents to a declaration, including passports edited inside and outside the signature, ML-DSA-65 co-signatures (wrong digest, wrong key, flipped bit, unregistered key), and two simultaneous clicks. |
| Browser | `node e2e/walkthrough.ts` | Drives the five demo steps in Chrome with Playwright, presses the "Try to cheat" buttons and waits for each refusal, opens the ledger and checks the example passport; fails on any page or console error. `FRAME=1` saves the README screenshots. |
| Types and lint | `npm run typecheck`, `npm run lint` | TypeScript strict mode; Next.js and React hooks rules. |

CI runs the contract, unit, type and lint suites on every push ([.github/workflows/ci.yml](../.github/workflows/ci.yml)).

## AI reading

With `ANTHROPIC_API_KEY` set, the Evidence step sends each sample PDF to Claude Opus 5.5 and shows the returned lines next to the reference readings the samples were generated from (`lib/samples/marmara.ts`), so a misread is visible line by line. The duplicate-invoice rule does not depend on the model: it compares document numbers.

## User testing

No user testing with mills, verifiers or importers was possible within the hackathon. The pilot plan in [adoption.md](adoption.md) defines what to measure first: verifier hours per report, importer acceptance, and the time from quarter end to passport.
