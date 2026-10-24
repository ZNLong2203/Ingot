/**
 * Calculation factors, each with its source. The engine reads nothing that
 * is not listed here, so a verifier can audit every number in one place.
 */

export interface Factor {
  value: number;
  unit: string;
  source: string;
  url?: string;
}

export const factors = {
  /** IPCC 2006 Guidelines, Vol. 2 (Energy), ch. 2, table 2.2: default CO2 emission factor for natural gas. */
  naturalGasEf: {
    value: 56.1,
    unit: "t CO2 / TJ (NCV)",
    source: "IPCC 2006 Guidelines, Vol. 2, ch. 2, table 2.2",
    url: "https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_2_Ch2_Stationary_Combustion.pdf",
  },
  /** IPCC 2006 Guidelines, Vol. 2, ch. 1, §1.4.1.2: NCV of natural gas is about 10 % below GCV. */
  naturalGasNcvPerGcv: {
    value: 0.9,
    unit: "NCV / GCV",
    source: "IPCC 2006 Guidelines, Vol. 2, ch. 1, §1.4.1.2",
    url: "https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_1_Ch1_Introduction.pdf",
  },
  naturalGasOxidation: {
    value: 1,
    unit: "fraction",
    source: "IPCC 2006 Guidelines, Vol. 2, ch. 2 (default oxidation factor 1)",
  },
  /** Stoichiometric CO2 per tonne of carbon. */
  co2PerCarbon: { value: 44.0095 / 12.011, unit: "t CO2 / t C", source: "Molar masses of CO2 and C" },
  /** Graphite electrodes are almost pure carbon; the EU MRR standard factor. */
  electrodeEf: {
    value: 3.663,
    unit: "t CO2 / t electrode",
    source: "Commission Implementing Regulation (EU) 2018/2066 (MRR), Annex VI",
  },
  /** Stoichiometric factors for carbonate decomposition. */
  limestoneEf: { value: 0.44, unit: "t CO2 / t CaCO3", source: "Stoichiometry, MRR Annex VI table 2" },
  dolomiteEf: { value: 0.477, unit: "t CO2 / t CaMg(CO3)2", source: "Stoichiometry, MRR Annex VI table 2" },
  /** Grid factor for indirect emissions of electricity drawn from the Turkish grid. */
  gridEfTurkey: {
    value: 0.44,
    unit: "t CO2 / MWh",
    source: "Placeholder pending the national factor",
  },
  kcalToKwh: { value: 4.1868 / 3600, unit: "kWh / kcal", source: "Definition of the international table calorie" },
} satisfies Record<string, Factor>;

export type FactorKey = keyof typeof factors;
