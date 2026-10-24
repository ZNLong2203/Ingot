/**
 * Calculation factors, each with its source. The engine reads nothing that
 * is not listed here, so a verifier can audit every number in one place.
 *
 * Standard factors for iron and steel come from Implementing Regulation
 * (EU) 2025/2547, Annex II point G (identical to Reg. 2023/1773 Annex VIII
 * and to the MRR, Reg. 2018/2066 Annex VI).
 */

export interface Factor {
  value: number;
  unit: string;
  source: string;
  url?: string;
}

const METHOD = "http://data.europa.eu/eli/reg_impl/2025/2547/oj";

export const factors = {
  naturalGasEf: {
    value: 56.1,
    unit: "t CO2 / TJ (NCV)",
    source: "Reg. 2025/2547 Annex II.G table 1 (IPCC 2006 default)",
    url: METHOD,
  },
  /** Invoices state gross calorific value; NCV of natural gas is about 10 % lower. */
  naturalGasNcvPerGcv: {
    value: 0.9,
    unit: "NCV / GCV",
    source: "IPCC 2006 Guidelines, Vol. 2, ch. 1, §1.4.1.2",
    url: "https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_1_Ch1_Introduction.pdf",
  },
  naturalGasOxidation: { value: 1, unit: "fraction", source: "Reg. 2025/2547 Annex II.B.3.1.1: OF = 1 may always be used", url: METHOD },
  co2PerCarbon: { value: 3.664, unit: "t CO2 / t C", source: "Reg. 2025/2547 Annex II.B.3.1.1, eq. 9", url: METHOD },
  // Carbon-bearing inputs and outputs of the EAF mass balance (table 5).
  electrodeEf: { value: 3.0, unit: "t CO2 / t (C 0.8188)", source: "Reg. 2025/2547 Annex II.G table 5, EAF carbon electrodes", url: METHOD },
  chargeCarbonEf: { value: 3.04, unit: "t CO2 / t (C 0.8297)", source: "Reg. 2025/2547 Annex II.G table 5, EAF charge carbon", url: METHOD },
  scrapEf: { value: 0.04, unit: "t CO2 / t (C 0.0109)", source: "Reg. 2025/2547 Annex II.G table 5, steel / steel scrap", url: METHOD },
  pigIronCarbonEf: { value: 0.15, unit: "t CO2 / t (C 0.0409)", source: "Reg. 2025/2547 Annex II.G table 5, pig iron", url: METHOD },
  steelEf: { value: 0.04, unit: "t CO2 / t (C 0.0109)", source: "Reg. 2025/2547 Annex II.G table 5, steel", url: METHOD },
  // Carbonates charged raw (table 3); dolomite from the regulation's stoichiometric formula.
  limestoneEf: { value: 0.44, unit: "t CO2 / t CaCO3", source: "Reg. 2025/2547 Annex II.G table 3", url: METHOD },
  dolomiteEf: { value: 0.477, unit: "t CO2 / t CaMg(CO3)2", source: "Stoichiometric: 2 × 44.01 / 184.40", url: METHOD },
  /**
   * Default grid factor for Türkiye in the CBAM default values act. It only
   * matters where indirect emissions count (cement, fertilisers); for iron
   * and steel it is reported for information.
   */
  gridEfTurkey: {
    value: 0.42,
    unit: "t CO2e / MWh",
    source: "Implementing Reg. (EU) 2025/2621, Annex II (Türkiye)",
    url: "http://data.europa.eu/eli/reg_impl/2025/2621/oj",
  },
  kcalToKwh: { value: 4.1868 / 3600, unit: "kWh / kcal", source: "International table calorie" },
} satisfies Record<string, Factor>;

export type FactorKey = keyof typeof factors;
