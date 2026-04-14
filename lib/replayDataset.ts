export type ReplayBar = {
  date: string;
  close: number;
  volume: number;
};

export type ReplayStockProfile = {
  ticker: string;
  name: string;
  sector: string;
  marketCap: number;
  high52: number;
  low52: number;
  description: string;
};

export type ReplaySymbolDataset = {
  profile: ReplayStockProfile;
  bars: ReplayBar[];
  source: "placeholder-manual";
};

const SHARED_TRADING_DATES = [
  "2024-03-25",
  "2024-03-26",
  "2024-03-27",
  "2024-03-28",
  "2024-04-01",
  "2024-04-02",
  "2024-04-03",
  "2024-04-04",
  "2024-04-05",
  "2024-04-08",
  "2024-04-09",
  "2024-04-10",
] as const;

const CLOSE_PATTERNS = {
  steadyGain: [0.955, 0.961, 0.968, 0.974, 0.979, 0.985, 0.99, 0.996, 1.004, 1.01, 1.018, 1],
  steadyLoss: [1.048, 1.04, 1.032, 1.028, 1.021, 1.014, 1.009, 1.003, 0.998, 0.992, 0.987, 1],
  breakout: [0.932, 0.939, 0.947, 0.954, 0.962, 0.975, 0.989, 1.006, 1.024, 1.031, 1.043, 1],
  pullback: [1.068, 1.056, 1.049, 1.041, 1.033, 1.025, 1.017, 1.009, 1.002, 0.994, 0.989, 1],
  rangeUp: [0.982, 0.988, 0.979, 0.991, 0.997, 0.989, 1.004, 1.01, 1.002, 1.013, 1.008, 1],
  rangeDown: [1.018, 1.011, 1.021, 1.009, 1.003, 1.014, 0.999, 0.992, 1.001, 0.991, 0.996, 1],
} as const;

const VOLUME_PATTERNS = {
  active: [1.1, 1.05, 0.98, 1.02, 0.96, 1.08, 1.12, 1.06, 0.99, 1.14, 1.07, 1],
  quiet: [0.92, 0.95, 0.97, 0.93, 0.96, 1, 1.03, 0.98, 0.94, 0.99, 1.02, 1],
  surge: [0.88, 0.9, 0.94, 0.97, 1, 1.08, 1.16, 1.22, 1.29, 1.18, 1.11, 1],
  fade: [1.25, 1.19, 1.12, 1.08, 1.03, 1, 0.97, 0.94, 0.91, 0.95, 0.98, 1],
} as const;

function roundPrice(value: number): number {
  return Number(value.toFixed(2));
}

function roundVolume(value: number): number {
  return Math.max(1, Math.round(value));
}

function createBars(
  terminalClose: number,
  terminalVolume: number,
  closePattern: readonly number[],
  volumePattern: readonly number[]
): ReplayBar[] {
  return SHARED_TRADING_DATES.map((date, index) => ({
    date,
    close: roundPrice(terminalClose * closePattern[index]),
    volume: roundVolume(terminalVolume * volumePattern[index]),
  }));
}

function buildDataset(
  profile: ReplayStockProfile,
  terminalClose: number,
  terminalVolume: number,
  closePattern: readonly number[],
  volumePattern: readonly number[]
): ReplaySymbolDataset {
  return {
    profile,
    bars: createBars(terminalClose, terminalVolume, closePattern, volumePattern),
    source: "placeholder-manual",
  };
}

// This app is ready for real PSX historical daily bars, but this repo does not
// bundle them yet. The official PSX portal is public for manual viewing, while
// automated access and redistribution terms are restrictive and not exposed as a
// stable developer API. Until licensed/permitted JSON is added, these bars are
// explicitly placeholder sample data used only to drive the replay engine.
export const REPLAY_DATA_SOURCE_NOTE =
  "Placeholder sample daily bars. Replace with manually provided or licensed PSX historical JSON before treating replay output as real market history.";

export const REPLAY_DATASET: ReplaySymbolDataset[] = [
  buildDataset(
    {
      ticker: "OGDC",
      name: "Oil & Gas Development Company",
      sector: "Energy",
      marketCap: 775_000_000_000,
      high52: 198.4,
      low52: 152.1,
      description:
        "OGDC is one of Pakistan's largest exploration and production companies, focused on hydrocarbon development across the country.",
    },
    180.25,
    4_250_000,
    CLOSE_PATTERNS.rangeUp,
    VOLUME_PATTERNS.active
  ),
  buildDataset(
    {
      ticker: "HBL",
      name: "Habib Bank Limited",
      sector: "Banking",
      marketCap: 205_000_000_000,
      high52: 152,
      low52: 118.3,
      description:
        "HBL is a leading commercial bank in Pakistan with a broad retail and corporate footprint and regional presence.",
    },
    139.8,
    3_100_000,
    CLOSE_PATTERNS.pullback,
    VOLUME_PATTERNS.fade
  ),
  buildDataset(
    {
      ticker: "LUCK",
      name: "Lucky Cement Limited",
      sector: "Cement",
      marketCap: 293_000_000_000,
      high52: 940,
      low52: 780,
      description:
        "Lucky Cement is a major cement producer in Pakistan with integrated operations and export-oriented capacity.",
    },
    905.5,
    890_000,
    CLOSE_PATTERNS.breakout,
    VOLUME_PATTERNS.surge
  ),
  buildDataset(
    {
      ticker: "PSO",
      name: "Pakistan State Oil",
      sector: "Energy",
      marketCap: 126_000_000_000,
      high52: 285.6,
      low52: 235.2,
      description:
        "PSO is Pakistan's largest oil marketing company, distributing fuels and lubricants nationwide.",
    },
    268.4,
    2_400_000,
    CLOSE_PATTERNS.steadyGain,
    VOLUME_PATTERNS.active
  ),
  buildDataset(
    {
      ticker: "ENGRO",
      name: "Engro Corporation Limited",
      sector: "Conglomerate",
      marketCap: 141_000_000_000,
      high52: 318,
      low52: 265.4,
      description:
        "Engro operates across fertilizers, foods, energy, and petrochemicals with a diversified industrial portfolio.",
    },
    292.75,
    1_050_000,
    CLOSE_PATTERNS.rangeDown,
    VOLUME_PATTERNS.quiet
  ),
  buildDataset(
    {
      ticker: "UBL",
      name: "United Bank Limited",
      sector: "Banking",
      marketCap: 218_000_000_000,
      high52: 189.5,
      low52: 155.2,
      description:
        "UBL provides retail, corporate, and Islamic banking services with a strong domestic branch network.",
    },
    178.6,
    2_200_000,
    CLOSE_PATTERNS.steadyGain,
    VOLUME_PATTERNS.quiet
  ),
  buildDataset(
    {
      ticker: "MCB",
      name: "MCB Bank Limited",
      sector: "Banking",
      marketCap: 249_000_000_000,
      high52: 225,
      low52: 188,
      description:
        "MCB Bank is a systemically important bank in Pakistan known for digital innovation and asset quality.",
    },
    211.3,
    1_650_000,
    CLOSE_PATTERNS.pullback,
    VOLUME_PATTERNS.quiet
  ),
  buildDataset(
    {
      ticker: "HUBC",
      name: "The Hub Power Company",
      sector: "Power",
      marketCap: 118_000_000_000,
      high52: 102.4,
      low52: 76.8,
      description:
        "HUBC operates large thermal power assets and is a key player in Pakistan's independent power producer sector.",
    },
    91.15,
    5_800_000,
    CLOSE_PATTERNS.steadyLoss,
    VOLUME_PATTERNS.active
  ),
  buildDataset(
    {
      ticker: "TRG",
      name: "TRG Pakistan Limited",
      sector: "Technology",
      marketCap: 42_000_000_000,
      high52: 135,
      low52: 72.5,
      description:
        "TRG Pakistan is linked to global BPO and technology services through its international affiliate structure.",
    },
    98.2,
    12_500_000,
    CLOSE_PATTERNS.breakout,
    VOLUME_PATTERNS.surge
  ),
  buildDataset(
    {
      ticker: "BAFL",
      name: "Bank Alfalah Limited",
      sector: "Banking",
      marketCap: 79_000_000_000,
      high52: 48.6,
      low52: 38.1,
      description:
        "Bank Alfalah offers retail, corporate, Islamic, and consumer banking with a growing digital franchise.",
    },
    44.85,
    8_900_000,
    CLOSE_PATTERNS.rangeUp,
    VOLUME_PATTERNS.active
  ),
  buildDataset(
    {
      ticker: "MARI",
      name: "Mari Petroleum Company",
      sector: "Energy",
      marketCap: 240_000_000_000,
      high52: 1925,
      low52: 1520,
      description:
        "Mari Petroleum focuses on natural gas production from the Mari field and adjacent exploration blocks.",
    },
    1798,
    125_000,
    CLOSE_PATTERNS.steadyGain,
    VOLUME_PATTERNS.quiet
  ),
  buildDataset(
    {
      ticker: "SEARL",
      name: "The Searle Company Limited",
      sector: "Pharmaceuticals",
      marketCap: 18_500_000_000,
      high52: 88.2,
      low52: 66.4,
      description:
        "Searle manufactures pharmaceuticals, nutraceuticals, and consumer health products for domestic markets.",
    },
    79.45,
    620_000,
    CLOSE_PATTERNS.rangeDown,
    VOLUME_PATTERNS.fade
  ),
  buildDataset(
    {
      ticker: "KOHC",
      name: "Kohinoor Energy Limited",
      sector: "Power",
      marketCap: 5_200_000_000,
      high52: 198,
      low52: 155,
      description:
        "Kohinoor Energy operates power generation capacity serving industrial and grid demand in Pakistan.",
    },
    182.3,
    210_000,
    CLOSE_PATTERNS.steadyLoss,
    VOLUME_PATTERNS.quiet
  ),
  buildDataset(
    {
      ticker: "MLCF",
      name: "Maple Leaf Cement Factory",
      sector: "Cement",
      marketCap: 21_000_000_000,
      high52: 45.2,
      low52: 33.8,
      description:
        "Maple Leaf Cement is an established cement manufacturer with plants serving construction demand.",
    },
    39.6,
    3_400_000,
    CLOSE_PATTERNS.steadyLoss,
    VOLUME_PATTERNS.fade
  ),
  buildDataset(
    {
      ticker: "DGKC",
      name: "D.G. Khan Cement Company",
      sector: "Cement",
      marketCap: 36_000_000_000,
      high52: 89.4,
      low52: 68.2,
      description:
        "DG Khan Cement operates large-scale cement production with distribution across Pakistan.",
    },
    81.9,
    2_750_000,
    CLOSE_PATTERNS.rangeUp,
    VOLUME_PATTERNS.active
  ),
];

const datasetByTicker = Object.fromEntries(
  REPLAY_DATASET.map((item) => [item.profile.ticker, item])
) as Record<string, ReplaySymbolDataset>;

export function getReplayDatasetByTicker(
  ticker: string
): ReplaySymbolDataset | undefined {
  return datasetByTicker[ticker.toUpperCase()];
}

export function getReplayProfiles(): ReplayStockProfile[] {
  return REPLAY_DATASET.map((item) => item.profile);
}

export function getReplayProfileByTicker(
  ticker: string
): ReplayStockProfile | undefined {
  return getReplayDatasetByTicker(ticker)?.profile;
}

export function getReplayDates(): readonly string[] {
  return SHARED_TRADING_DATES;
}

export function getReplaySectors(): string[] {
  return Array.from(new Set(getReplayProfiles().map((stock) => stock.sector))).sort();
}
