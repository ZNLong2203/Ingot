# Problem statement and solution overview

## Problem

Since 1 January 2026 the European Union charges importers for the carbon embedded in iron and steel, aluminium, cement, fertilisers, hydrogen and electricity (Carbon Border Adjustment Mechanism, Regulation (EU) 2023/956). Importers can declare the producer's actual emissions only if an EU-accredited verifier has verified them; otherwise they must use the Commission's default values, which carry a mark-up of 10 % in 2026, 20 % in 2027 and 30 % from 2028.

Türkiye is the EU's second-largest source of CBAM goods (€10.8 bn in 2025) and its largest by volume. About 70 % of Turkish steel comes from scrap-based electric arc furnaces, yet the default for Turkish hot-rolled coil (2.428 t CO2e/t before mark-up) reflects the blast-furnace route. Three things stand between a clean Turkish mill and a fair price:

1. **Producing verified data is slow and scarce.** Evidence is scattered across Turkish-language invoices and plant reports; EU-accredited verifiers only began to appear in autumn 2026; Turkish-accredited ones are not recognised.
2. **Verified data does not travel safely.** Each importer asks separately; nothing stops the same "green" tonnes being promised to two buyers, or a downstream mill passing on cleaner figures than the precursors it bought; process data is commercially sensitive.
3. **Without it, CBAM does not reward decarbonisation.** On default values a mill's emission cuts are worth nothing to its EU buyers.

## Solution

**Ingot** produces a verified CBAM statement from a mill's evidence and lets each verified tonne travel to exactly one end.

- **AI reading.** Claude reads invoices, meter statements, production reports and delivery notes in Turkish or English and returns each number with its source text.
- **The EU method in code.** The definitive-period methodology (Reg. 2025/2547): a carbon mass balance for the EAF, combustion for the reheating furnace, verified precursors read from the ledger, and the obligation with the 2026 benchmarks, CBAM factor and certificate price.
- **Verification and signature.** Plausibility checks against EU BAT ranges, a salted Merkle root of the report, and an EIP-712 signature by an accredited verifier.
- **A registry contract that keeps one count.** Verified once; sold once; ended once (declared or consumed); and no laundering: a product must carry the embedded emissions of the verified precursors it consumed, recomputed on chain.
- **Passports.** Each shipment carries a W3C-shaped credential the importer checks against the ledger in seconds, with only the fields it needs disclosed.

## Users

Non-EU producers (operators), EU importers (authorised declarants), accredited verifiers, customs authorities, and chambers of industry that run the network for their members.

## Result in the demo

A fictional Kocaeli mill's quarter: 0.354 t CO2e per tonne of coil instead of the 2.671 default; 0.132 instead of 1.335 certificates per tonne; about €99 less per tonne for the EU buyer at the Q3 2026 certificate price. Every attempt to reuse tonnes, edit a signed figure, or launder precursor carbon is refused by the contract, live in the browser.

## Scale and adoption

A permissioned EVM network run by chambers of industry and verifiers, integrated with the EU CBAM Registry; one verification serves every buyer; yearly EU parameter changes need no contract upgrade. See [adoption.md](adoption.md) and [impact.md](impact.md).
