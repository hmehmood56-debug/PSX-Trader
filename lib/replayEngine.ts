"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  REPLAY_DATASET,
  REPLAY_DATA_SOURCE_NOTE,
  getReplayDatasetByTicker,
  getReplayDates,
  type ReplayBar,
  type ReplayStockProfile,
} from "./replayDataset";

export type LiveQuote = {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  previousClose: number;
  date: string;
};

export type ReplayHistoryPoint = {
  date: string;
  price: number;
  volume: number;
};

export type ReplayStock = ReplayStockProfile & LiveQuote;

type ReplayContextValue = {
  dayIndex: number;
  currentDate: string;
  dataSourceNote: string;
  isPlaceholderData: boolean;
  getQuote: (ticker: string) => LiveQuote | undefined;
  getStocksWithLive: () => ReplayStock[];
  getHistory: (ticker: string) => ReplayHistoryPoint[];
};

const REPLAY_INTERVAL_MS = 3000;

function buildQuote(bars: ReplayBar[], dayIndex: number): LiveQuote {
  const safeIndex = Math.max(0, Math.min(dayIndex, bars.length - 1));
  const currentBar = bars[safeIndex];
  const previousBar = safeIndex > 0 ? bars[safeIndex - 1] : currentBar;
  const change = currentBar.close - previousBar.close;
  const changePercent =
    previousBar.close !== 0 ? (change / previousBar.close) * 100 : 0;

  return {
    price: currentBar.close,
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    volume: currentBar.volume,
    previousClose: previousBar.close,
    date: currentBar.date,
  };
}

const ReplayContext = createContext<ReplayContextValue | null>(null);

export function ReplayMarketProvider({ children }: { children: ReactNode }) {
  const replayDates = useMemo(() => [...getReplayDates()], []);
  const [dayIndex, setDayIndex] = useState(0);

  useEffect(() => {
    if (replayDates.length <= 1) return;

    const id = window.setInterval(() => {
      setDayIndex((prev) => (prev + 1) % replayDates.length);
    }, REPLAY_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [replayDates.length]);

  const getQuote = useCallback(
    (ticker: string): LiveQuote | undefined => {
      const series = getReplayDatasetByTicker(ticker);
      return series ? buildQuote(series.bars, dayIndex) : undefined;
    },
    [dayIndex]
  );

  const getStocksWithLive = useCallback((): ReplayStock[] => {
    return REPLAY_DATASET.map((item) => ({
      ...item.profile,
      ...buildQuote(item.bars, dayIndex),
    }));
  }, [dayIndex]);

  const getHistory = useCallback(
    (ticker: string): ReplayHistoryPoint[] => {
      const series = getReplayDatasetByTicker(ticker);
      if (!series) return [];

      return series.bars
        .slice(0, dayIndex + 1)
        .map((bar) => ({ date: bar.date, price: bar.close, volume: bar.volume }));
    },
    [dayIndex]
  );

  const value = useMemo(
    () => ({
      dayIndex,
      currentDate: replayDates[dayIndex] ?? "",
      dataSourceNote: REPLAY_DATA_SOURCE_NOTE,
      isPlaceholderData: true,
      getQuote,
      getStocksWithLive,
      getHistory,
    }),
    [dayIndex, getHistory, getQuote, getStocksWithLive, replayDates]
  );

  return createElement(ReplayContext.Provider, { value }, children);
}

export function useReplayMarket(): ReplayContextValue {
  const ctx = useContext(ReplayContext);
  if (!ctx) {
    throw new Error("useReplayMarket must be used within ReplayMarketProvider");
  }
  return ctx;
}
