export type MarketSeedPoint = {
  price: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  volumeEstimate: number;
  averageVolumeEstimate: number;
  dividendYield?: number;
};

export type MarketSeed = {
  asOf: string;
  source: string;
  kse100: {
    value: number;
    open: number;
    high: number;
    low: number;
    volume: number;
  };
  stocks: Record<string, MarketSeedPoint>;
};

// Anchor data snapshot for simulation seeding (Apr 14, 2026).
// Source used for this project seed layer: market summary snapshot at ksestocks.com,
// with KSE-100 anchor aligned to the value provided by the user.
export const CURRENT_MARKET_SEED: MarketSeed = {
  asOf: "2026-04-14",
  source: "PSX market summary snapshot (Apr 14, 2026)",
  kse100: {
    value: 165634.84,
    open: 163416.54,
    high: 165763.81,
    low: 163416.54,
    volume: 358200598,
  },
  stocks: {
    OGDC: { price: 299.63, previousClose: 293.48, dayHigh: 300.8, dayLow: 297.6, volumeEstimate: 3863235, averageVolumeEstimate: 3400000 },
    HBL: { price: 301.16, previousClose: 294.21, dayHigh: 303.5, dayLow: 298.1, volumeEstimate: 2290803, averageVolumeEstimate: 2100000, dividendYield: 0.09 },
    LUCK: { price: 434.36, previousClose: 410.06, dayHigh: 438, dayLow: 420, volumeEstimate: 4056475, averageVolumeEstimate: 3700000, dividendYield: 0.035 },
    PSO: { price: 362.22, previousClose: 350.13, dayHigh: 364.2, dayLow: 355.26, volumeEstimate: 1995341, averageVolumeEstimate: 1850000 },
    ENGRO: { price: 279.07, previousClose: 269.72, dayHigh: 279.53, dayLow: 272.99, volumeEstimate: 1216665, averageVolumeEstimate: 1100000, dividendYield: 0.06 },
    UBL: { price: 355.93, previousClose: 342.73, dayHigh: 359, dayLow: 350, volumeEstimate: 2309702, averageVolumeEstimate: 2200000, dividendYield: 0.095 },
    MCB: { price: 405.62, previousClose: 399.94, dayHigh: 409, dayLow: 402.5, volumeEstimate: 241134, averageVolumeEstimate: 280000, dividendYield: 0.085 },
    HUBC: { price: 212.94, previousClose: 206.5, dayHigh: 214.3, dayLow: 209.5, volumeEstimate: 4673994, averageVolumeEstimate: 4300000, dividendYield: 0.08 },
    TRG: { price: 57.58, previousClose: 55.49, dayHigh: 58.49, dayLow: 56.12, volumeEstimate: 4428176, averageVolumeEstimate: 4000000 },
    BAFL: { price: 121.34, previousClose: 118.42, dayHigh: 122.5, dayLow: 120.1, volumeEstimate: 2130012, averageVolumeEstimate: 1900000 },
    MARI: { price: 656.67, previousClose: 646.15, dayHigh: 660, dayLow: 652.1, volumeEstimate: 492682, averageVolumeEstimate: 560000, dividendYield: 0.03 },
    SEARL: { price: 93.75, previousClose: 89.68, dayHigh: 94.18, dayLow: 91.51, volumeEstimate: 3485999, averageVolumeEstimate: 3000000 },
    KOHC: { price: 92.55, previousClose: 86.71, dayHigh: 93, dayLow: 88, volumeEstimate: 1105905, averageVolumeEstimate: 900000 },
    MLCF: { price: 93.8, previousClose: 86.86, dayHigh: 94.39, dayLow: 88.5, volumeEstimate: 20991076, averageVolumeEstimate: 18000000 },
    DGKC: { price: 190.56, previousClose: 176.87, dayHigh: 192.5, dayLow: 182.8, volumeEstimate: 12157676, averageVolumeEstimate: 10000000 },
  },
};

export function getSeedForTicker(ticker: string): MarketSeedPoint | undefined {
  return CURRENT_MARKET_SEED.stocks[ticker.toUpperCase()];
}
