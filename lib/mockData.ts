import {
  REPLAY_DATASET,
  getReplayProfileByTicker,
  getReplaySectors,
  type ReplayStockProfile,
} from "./replayDataset";

export type Stock = ReplayStockProfile & {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
};

function toSnapshot(profile: ReplayStockProfile): Stock {
  const series = REPLAY_DATASET.find((item) => item.profile.ticker === profile.ticker);
  const latest = series?.bars[series.bars.length - 1];
  const previous = series?.bars[series.bars.length - 2] ?? latest;
  const change = (latest?.close ?? 0) - (previous?.close ?? 0);
  const changePercent =
    previous && previous.close !== 0 ? (change / previous.close) * 100 : 0;

  return {
    ...profile,
    price: Number((latest?.close ?? 0).toFixed(2)),
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    volume: latest?.volume ?? 0,
  };
}

// Compatibility exports for server-rendered pages that still need static
// company metadata. Runtime quote values come from the live PSX feed layer.
export const MOCK_STOCKS: Stock[] = REPLAY_DATASET.map((item) =>
  toSnapshot(item.profile)
);

export function getStockByTicker(ticker: string): Stock | undefined {
  const profile = getReplayProfileByTicker(ticker);
  return profile ? toSnapshot(profile) : undefined;
}

export function getAllSectors(): string[] {
  return getReplaySectors();
}
