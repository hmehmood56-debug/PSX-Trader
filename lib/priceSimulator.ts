// TO SWAP FOR REAL API: Replace this file with your data provider integration
// Expected shape: live map of ticker -> { price, change, changePercent } from last close or streaming ticks
// Recommended providers: Mettis Global, KSE Live API

"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MOCK_STOCKS, type Stock } from "./mockData";

export type LiveQuote = {
  price: number;
  change: number;
  changePercent: number;
};

type PricesMap = Record<string, LiveQuote>;

function clampPct(delta: number): number {
  const max = 0.005;
  return Math.max(-max, Math.min(max, delta));
}

function randomDelta(): number {
  return (Math.random() * 2 - 1) * 0.005;
}

function initFromMock(): PricesMap {
  const m: PricesMap = {};
  for (const s of MOCK_STOCKS) {
    m[s.ticker] = {
      price: s.price,
      change: s.change,
      changePercent: s.changePercent,
    };
  }
  return m;
}

type PriceSimulatorContextValue = {
  prices: PricesMap;
  getQuote: (ticker: string) => LiveQuote | undefined;
  getStocksWithLive: () => (Stock & LiveQuote)[];
};

const PriceSimulatorContext = createContext<PriceSimulatorContextValue | null>(
  null
);

export function PriceSimulatorProvider({ children }: { children: ReactNode }) {
  const baseline = useMemo(() => initFromMock(), []);
  const openRef = useRef<Record<string, number>>({});
  if (Object.keys(openRef.current).length === 0) {
    for (const s of MOCK_STOCKS) {
      openRef.current[s.ticker] = s.price - s.change;
    }
  }

  const [prices, setPrices] = useState<PricesMap>(() => ({ ...baseline }));

  useEffect(() => {
    const id = setInterval(() => {
      setPrices((prev) => {
        const next: PricesMap = { ...prev };
        for (const s of MOCK_STOCKS) {
          const cur = next[s.ticker]?.price ?? s.price;
          const delta = clampPct(randomDelta());
          const newPrice = Math.max(0.01, cur * (1 + delta));
          const open = openRef.current[s.ticker] ?? s.price - s.change;
          const change = newPrice - open;
          const changePercent = open !== 0 ? (change / open) * 100 : 0;
          next[s.ticker] = {
            price: Number(newPrice.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2)),
          };
        }
        return next;
      });
    }, 3000);

    return () => clearInterval(id);
  }, []);

  const getQuote = useCallback(
    (ticker: string) => prices[ticker.toUpperCase()],
    [prices]
  );

  const getStocksWithLive = useCallback((): (Stock & LiveQuote)[] => {
    return MOCK_STOCKS.map((s) => {
      const q = prices[s.ticker];
      return {
        ...s,
        price: q?.price ?? s.price,
        change: q?.change ?? s.change,
        changePercent: q?.changePercent ?? s.changePercent,
      };
    });
  }, [prices]);

  const value = useMemo(
    () => ({ prices, getQuote, getStocksWithLive }),
    [prices, getQuote, getStocksWithLive]
  );

  return createElement(
    PriceSimulatorContext.Provider,
    { value },
    children
  );
}

export function useLivePrices(): PriceSimulatorContextValue {
  const ctx = useContext(PriceSimulatorContext);
  if (!ctx) {
    throw new Error("useLivePrices must be used within PriceSimulatorProvider");
  }
  return ctx;
}
