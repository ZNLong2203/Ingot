# Climate impact assessment

## The mechanism

CBAM puts the EU carbon price on the emissions embedded in imported goods. It reduces emissions only if two things hold:

1. **The price reaches the producer's decisions.** An exporter's own emission cuts must change what its buyers pay. With default values they do not: the default is fixed per country and product, so a Turkish mill that cuts its emissions is priced exactly like one that does not.
2. **The accounting is closed.** A verified low figure must not be counted twice (sold to two importers) or passed off onto goods it does not belong to (a re-roller claiming cleaner coil than the slabs it bought). Otherwise the price signal leaks and the EU pays for reductions that did not happen.

Ingot addresses both: it makes verified actual data cheap to produce and portable (AI reading, the EU method in code, a passport the importer can check), and it closes the accounting with a contract that counts each verified tonne once and carries precursor emissions downstream.

## The price signal, quantified for the demo mill

The demo mill (scrap-based EAF with a hot strip mill, 171,200 t of coil per quarter, all figures in [method](../app/method/page.tsx)):

| | Default value | Verified actual |
|---|---|---|
| Specific embedded emissions (t CO2e/t) | 2.671 (2.428 + 10 %) | 0.354 |
| Free allocation adjustment (t/t, 2026) | 1.336 (column B, route C) | 0.221 (column A through precursors) |
| Certificates per tonne | 1.335 | 0.132 |
| Cost per tonne at €82.32 (Q3 2026) | €109.90 | €10.90 |

On default values, the mill's buyers pay €109.90 per tonne whatever the mill does. On verified data, **each 0.1 t CO2e/t the mill avoids saves its buyers €8.23 per tonne** in 2026, and the saving grows to the full carbon price as the CBAM factor falls to zero in 2034 and the free allocation adjustment disappears.

Because actual data itemises where the carbon comes from, the levers become visible and priced. For the demo mill (annualised: 684,800 t of coil):

| Lever | Change | t CO2e avoided per year | Value to EU buyers per year, 2026 | from 2034 |
|---|---|---|---|---|
| Half the pig iron replaced by prime scrap | 36,000 t less pig iron at 1.91 t/t, and 0.11 t/t less carbon charged | ≈ 72,700 | ≈ €2.8 M (the pig iron's own benchmark is credited back in 2026) | ≈ €6.0 M |
| Half the anthracite charge carbon replaced by sustainable biocarbon (zero-rated as in the EU ETS) | 6,490 t of anthracite at 3.04 t/t | ≈ 19,700 | ≈ €1.6 M | ≈ €1.6 M |
| Reheating furnace from 1.27 to 1.20 GJ/t (BAT-AEPL lower bound) | 5.8 % less gas | ≈ 2,800 | ≈ €0.2 M | ≈ €0.2 M |

Values use the Q3 2026 certificate price, €82.32, held constant. These are illustrative and assume the whole output is exported to the EU; the point is that none of them is worth anything to the mill's EU sales while its buyers use default values.

## Projections for Türkiye

Assumptions, stated so they can be changed:

- Iron and steel exported from Türkiye to the EU: **7.43 Mt** in 2025 (Eurostat Comext, via cbamguide.com).
- Share made by the scrap-EAF route: **70 %** (the industry's figure for production; the export share may differ) → about **5.2 Mt**.
- Average specific direct embedded emissions of that steel, including precursors: **0.35 t CO2e/t** (the demo mill's value; real mills vary).
- Share of that tonnage that reaches EU buyers with verified, portable data and responds to the price: the scenario variable.
- Reduction that responding mills achieve within three years: the scenario variable.

| Scenario | Tonnage on verified data | Reduction achieved | Emissions avoided per year |
|---|---|---|---|
| Low | 25 % (1.3 Mt) | 10 % (0.035 t/t) | ≈ 46,000 t CO2e |
| Mid | 50 % (2.6 Mt) | 20 % (0.07 t/t) | ≈ 182,000 t CO2e |
| High | 75 % (3.9 Mt) | 30 % (0.105 t/t) | ≈ 410,000 t CO2e |

`avoided = 5.2 Mt × share × 0.35 t/t × reduction`. This is a projection under stated assumptions, not a forecast. It leaves out the larger effect on blast-furnace producers and precursor choices (a mill that can show low-carbon DRI or scrap gets paid for it), and the effect of the same rules on aluminium, cement and fertiliser, where Turkish defaults are also contested.

## Integrity effects that do not show up in tonnes

- **No double-sold green steel.** A verified low-carbon tonne can be allocated once; the contract refuses the second sale. Without this, a mass-balance "green" claim sold to two buyers halves its real effect.
- **No carbon laundering through re-rolling.** A downstream product must carry the embedded emissions of the verified precursors it consumed; the contract recomputes them. This protects CBAM against a route the Commission has had to address in the default values themselves.
- **Cheaper verification for small exporters.** The evidence arrives structured, quoted and checked, which cuts verifier hours. Turkish SMEs face verification costs of €5,000 to €50,000 per installation (GMK estimate); every hour saved is a mill more likely to report actual data rather than accept the default.

## Effect of the tool itself

The demo runs in the browser; a production deployment on a permissioned proof-of-authority EVM network uses negligible energy per transaction. The AI reads a handful of documents per installation per quarter.
