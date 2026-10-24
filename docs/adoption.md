# Implementation, adoption and scalability

## Who uses it, and why they would

| User | Today | With Ingot | Who pays |
|---|---|---|---|
| Non-EU mill (operator) | Answers each importer's data request separately, by e-mail and spreadsheet; often accepts the default | One verified statement, split into passports per shipment; AI-prepared evidence for the verifier | The mill (cheaper verification, higher net price for its steel) |
| EU importer (authorised declarant) | Chases suppliers, cannot check what it receives, risks penalties of €100/t CO2 for under-declaration | Checks a passport in seconds; surrenders it once; keeps an audit trail | The importer (lower CBAM cost per tonne) |
| Accredited verifier | Receives unstructured evidence | Receives quoted, checked evidence; signs once; can withdraw | Billable verification with fewer hours |
| Customs / competent authority | Relies on declarations and the CBAM Registry | Can check any passport and see each tonne's end | — |
| Chamber of industry / exporters' association | Training and guidance | Runs a network node; offers the service to members | Membership services, sector programmes |

## Rollout

1. **Pilot (3 months).** One Turkish EAF mill, its EU buyers and one EU-accredited verifier, through a chamber of industry. Real evidence, real verification, a testnet or permissioned network. Success measures: verifier hours per report, importer acceptance, time from quarter end to passport.
2. **Sector network (6–12 months).** A permissioned EVM network (Hyperledger Besu, proof-of-authority) with nodes at chambers of industry, exporters' associations and participating verifiers. The same contract and passports; quantities visible to members only.
3. **Registry integration.** Export the statement summary in the format of the EU CBAM Registry's operator module, so the mill uploads once and shares passports with buyers; read authorised-declarant status from the Registry instead of trusting recipients.
4. **More goods and tiers.** Aluminium, cement and fertiliser need their own engines (cement and fertiliser also count indirect emissions, which the contract already carries); the precursor rules already cover multi-tier chains such as pig iron → slab → coil → tube.

## Adoption risks and answers

- *"The EU Registry already does this."* It stores and shares reports. It does not, by itself, count each verified tonne once across buyers and tiers, or carry precursor emissions in a way anyone can check. Ingot is designed to plug into it, not replace it.
- *"Mills will not put data on a blockchain."* They put a Merkle root on it. Fields are disclosed one at a time, with proofs, to the parties that need them.
- *"Verifiers are scarce."* Structured, quoted evidence and plausibility checks reduce hours per report; the network makes one verification serve every buyer.
- *"AI makes mistakes."* It only reads. Every number shows its source text and passes cited range checks before a person signs it.

## Scalability

- **Throughput.** A mill records about four statements a year and allocates per shipment: thousands of transactions per year per sector, trivially within any EVM network. Gas per operation: statement ≈ 288k, allocation ≈ 141k, declaration ≈ 23k.
- **Storage.** Fixed-size records per statement and allocation; report data stays off chain.
- **Precursor fan-in.** A statement consumes a bounded list of allocations; very large input lists can be pre-aggregated by the supplier into fewer allocations.
- **Upgrades.** Factors, benchmarks and prices live in the off-chain engine and are versioned with their legal sources; the contract only needs the signed result, so yearly changes to EU parameters need no contract upgrade.

## Sustainability of the project

- **Open source (MIT)**, so chambers, verifiers and software vendors can run and audit it.
- **Revenue options**: per-statement fees for hosted extraction and checking, verifier-side tooling, and network operation fees for sector bodies.
- **Maintenance**: yearly updates follow the EU's own cycle (benchmarks, default values, CBAM factor, mark-ups), all held in one table each in `lib/cbam/`.
