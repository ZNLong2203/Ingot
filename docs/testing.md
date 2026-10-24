# Testing

| Suite | Command | What it proves |
|---|---|---|
| Contract | `npm run contracts:test` | 30 tests on Hardhat's simulated network with viem: each refusal with its arguments (overlapping periods, tampered fields, unaccredited or suspended signers, over-allocation, reused shipment, double declaration, foreign recipient, revoked statements), the precursor rules (recomputed emissions, laundering floor, swapped inputs, reuse, revoked upstream), selective disclosure verified on chain against the app's own Merkle code, the correction path (periods reopened in either withdrawal order, precursors returned, customs references freed), the guards (self-attestation, future periods, empty addresses), and a 60-step randomised allocation sequence that checks the available quantity after every step. |
| Unit | `npm test` | 32 tests with Vitest: the engine against hand-computed values for every source stream, the recursive free allocation adjustment, default-value pricing and mark-ups, disclosure proofs (forged value, forged key, foreign root, single leaf), the in-page EVM running the same bytecode (EIP-712 signature, decoded custom errors, journal replay), and the whole demo flow from documents to a declaration, including passports edited inside and outside the signature, ML-DSA-65 co-signatures (wrong digest, wrong key, flipped bit, unregistered key), and two simultaneous clicks. The passport recorded for Sepolia is checked offline: statement id, signer, post-quantum co-signature and disclosures. |
| Browser | `node e2e/walkthrough.ts` | Drives the five demo steps in Chrome with Playwright, presses the "Try to cheat" buttons and waits for each refusal, opens the ledger, and checks the example passport on the sandbox and then live on Sepolia; fails on any page or console error. `FRAME=1` saves the README screenshots. |
| Testnet | `scripts/deploy-testnet.ts` | Replayed the demo on Ethereum Sepolia on 24 October 2026: 20 transactions mined, the double sale mined as failed with `ExceedsVerifiedQuantity`, source verified with an exact match on Sourcify ([deploy.md](deploy.md)). |
| Types and lint | `npm run typecheck`, `npm run lint` | TypeScript strict mode; Next.js and React hooks rules. |

CI runs the contract, unit, type and lint suites on every push ([.github/workflows/ci.yml](../.github/workflows/ci.yml)).

## AI reading

Result on 24 October 2026, live site, gemini-3.8-flash: **29 of 29 lines exact** (stream, month, unit, quantity within 0.1 %), no extra lines, 7 of 7 document numbers and copy flags right, no calorific value missed; 4.7 to 12.5 s per document.

With `GEMINI_API_KEY` set, the Evidence step sends each sample PDF to Gemini and shows the returned lines next to the reference readings the samples were generated from (`lib/samples/marmara.ts`), so a misread is visible line by line. The duplicate-invoice rule does not depend on the model: it compares document numbers.
