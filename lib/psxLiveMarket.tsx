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
import { REPLAY_DATASET, type ReplayStockProfile } from "./replayDataset";
import { PSX_TERMINAL_WS_URL } from "./psxTerminalApi";

export type TradeSide = "BUY" | "SELL";

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

export type MarketSnapshot = {
  sessionState: string;
  marketBreadth: number;
  turnoverEstimate: number;
  topGainers: ReplayStock[];
  topLosers: ReplayStock[];
  sectorLeaders: Array<{ sector: string; avgChangePercent: number }>;
  tickId: number;
  sessionLabel: string;
};

export type ExecutionEstimate = {
  side: TradeSide;
  estimatedPrice: number;
  spreadBps: number;
  slippageBps: number;
  delayMs: number;
};

type PriceContextValue = {
  currentDate: string;
  dataSourceNote: string;
  isPlaceholderData: boolean;
  getQuote: (ticker: string) => LiveQuote | undefined;
  getStocksWithLive: () => ReplayStock[];
  getHistory: (ticker: string) => ReplayHistoryPoint[];
  getMarketSnapshot: () => MarketSnapshot;
  estimateExecution: (ticker: string, side: TradeSide, shares: number) => ExecutionEstimate | undefined;
};

type QuoteState = {
  quote: LiveQuote;
  high?: number;
  low?: number;
};

const CURATED_PROFILES = REPLAY_DATASET.map((item) => item.profile);
const DEFAULT_QUOTES: Record<string, QuoteState> = Object.fromEntries(
  REPLAY_DATASET.map((item) => {
    const bars = item.bars;
    const latest = bars[bars.length - 1];
    const previous = bars[bars.length - 2] ?? latest;
    const change = latest.close - previous.close;
    const previousClose = previous.close;
    return [
      item.profile.ticker.toUpperCase(),
      {
        quote: {
          price: Number(latest.close.toFixed(2)),
          change: Number(change.toFixed(2)),
          changePercent: previousClose > 0 ? Number(((change / previousClose) * 100).toFixed(2)) : 0,
          volume: latest.volume,
          previousClose: Number(previousClose.toFixed(2)),
          date: new Date().toISOString(),
        },
      },
    ];
  })
);

const PriceContext = createContext<PriceContextValue | null>(null);

function buildFallbackProfile(ticker: string): ReplayStockProfile {
  return {
    ticker,
    name: `${ticker} (PSX)`,
    sector: "PSX Listed",
    marketCap: 0,
    high52: 0,
    low52: 0,
    description: "Live PSX listed ticker from PSX Terminal.",
  };
}

function toLiveQuote(price: number, change: number, volume: number, timestamp: number | string, previousClose: number): LiveQuote {
  return {
    price: Number(price.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePercent: previousClose !== 0 ? Number(((change / previousClose) * 100).toFixed(2)) : 0,
    volume: Math.max(0, Math.round(volume || 0)),
    previousClose: Number(previousClose.toFixed(2)),
    date: new Date(typeof timestamp === "number" ? timestamp * 1000 : timestamp).toISOString(),
  };
}

export function PsxLiveMarketProvider({ children }: { children: ReactNode }) {
  const [tickId, setTickId] = useState(0);
  const [stateTimestamp, setStateTimestamp] = useState(new Date().toISOString());
  const [isPlaceholderData, setIsPlaceholderData] = useState(true);
  const [connectionLabel, setConnectionLabel] = useState("connecting");
  const [profiles, setProfiles] = useState<ReplayStockProfile[]>(CURATED_PROFILES);
  const quotesRef = useRef<Record<string, QuoteState>>({ ...DEFAULT_QUOTES });
  const historyRef = useRef<Record<string, ReplayHistoryPoint[]>>({});
  const historyLoadStateRef = useRef<Record<string, "idle" | "loading" | "loaded" | "unavailable">>({});
  const quoteLoadStateRef = useRef<Record<string, "idle" | "loading" | "loaded" | "unavailable">>({});
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);

  const applyTick = useCallback((symbol: string, price: number, change: number, volume: number, timestamp: number, high?: number, low?: number) => {
    const ticker = symbol.toUpperCase();
    const previousClose = price - change;
    const quote = toLiveQuote(price, change, volume, timestamp, previousClose);
    quotesRef.current[ticker] = { quote, high, low };
    const history = historyRef.current[ticker] ?? [];
    historyRef.current[ticker] = [...history.slice(-120), { date: quote.date, price: quote.price, volume: quote.volume }];
    setStateTimestamp(new Date().toISOString());
    setTickId((prev) => prev + 1);
  }, []);

  const loadSnapshot = useCallback(async () => {
    try {
      const response = await fetch("/api/psx-terminal/market", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        data?: Array<{ symbol: string; price: number; change: number; volume: number; timestamp?: number; high?: number; low?: number }>;
      };
      if (!Array.isArray(payload.data)) return;
      payload.data.forEach((item) => {
        applyTick(item.symbol, item.price, item.change ?? 0, item.volume ?? 0, item.timestamp ?? Date.now() / 1000, item.high, item.low);
      });
      setIsPlaceholderData(false);
      setConnectionLabel("live");
    } catch {
      // Keep placeholder fallback data if request fails.
    }
  }, [applyTick]);

  const ensureQuote = useCallback(async (ticker: string) => {
    const key = ticker.toUpperCase();
    const state = quoteLoadStateRef.current[key] ?? "idle";
    if (state === "loading" || state === "loaded") return;
    quoteLoadStateRef.current[key] = "loading";
    try {
      const response = await fetch(`/api/psx-terminal/quote/${encodeURIComponent(key)}`, { cache: "no-store" });
      if (!response.ok) {
        quoteLoadStateRef.current[key] = "unavailable";
        return;
      }
      const payload = (await response.json()) as {
        data?: { symbol: string; price: number; change: number; volume: number; timestamp?: number; high?: number; low?: number } | null;
      };
      if (!payload.data || typeof payload.data.price !== "number") {
        quoteLoadStateRef.current[key] = "unavailable";
        return;
      }
      applyTick(
        payload.data.symbol,
        payload.data.price,
        payload.data.change ?? 0,
        payload.data.volume ?? 0,
        payload.data.timestamp ?? Date.now() / 1000,
        payload.data.high,
        payload.data.low
      );
      quoteLoadStateRef.current[key] = "loaded";
    } catch {
      quoteLoadStateRef.current[key] = "unavailable";
    }
  }, [applyTick]);

  const loadHistory = useCallback(async (ticker: string) => {
    const state = historyLoadStateRef.current[ticker] ?? "idle";
    if (state === "loading" || state === "loaded" || state === "unavailable") return;
    historyLoadStateRef.current[ticker] = "loading";
    try {
      const response = await fetch(`/api/psx-terminal/history/${ticker}`, { cache: "no-store" });
      if (!response.ok) {
        historyLoadStateRef.current[ticker] = "unavailable";
        return;
      }
      const payload = (await response.json()) as { data?: ReplayHistoryPoint[] };
      if (!Array.isArray(payload.data) || payload.data.length === 0) {
        historyLoadStateRef.current[ticker] = "unavailable";
        return;
      }
      historyRef.current[ticker] = payload.data.slice(-120);
      historyLoadStateRef.current[ticker] = "loaded";
      setTickId((prev) => prev + 1);
    } catch {
      historyLoadStateRef.current[ticker] = "unavailable";
      // Best-effort history bootstrap for chart initialization.
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
    const pollId = window.setInterval(() => {
      if (connectionLabel !== "live") {
        void loadSnapshot();
      }
    }, 20_000);
    return () => window.clearInterval(pollId);
  }, [connectionLabel, loadSnapshot]);

  useEffect(() => {
    let canceled = false;
    const loadSymbols = async () => {
      try {
        const response = await fetch("/api/psx-terminal/symbols", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { data?: string[] };
        if (!Array.isArray(payload.data) || payload.data.length === 0) return;
        if (canceled) return;
        const curatedByTicker = new Map(CURATED_PROFILES.map((profile) => [profile.ticker.toUpperCase(), profile]));
        const merged = payload.data.map((symbol) => curatedByTicker.get(symbol.toUpperCase()) ?? buildFallbackProfile(symbol.toUpperCase()));
        setProfiles(merged);
      } catch {
        // Keep curated fallback universe.
      }
    };
    void loadSymbols();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let isUnmounted = false;

    const connect = () => {
      setConnectionLabel("connecting");
      socket = new WebSocket(PSX_TERMINAL_WS_URL);

      socket.onopen = () => {
        reconnectAttemptRef.current = 0;
        setConnectionLabel("live");
        setIsPlaceholderData(false);
        socket?.send(
          JSON.stringify({
            type: "subscribe",
            subscriptionType: "marketData",
            params: { marketType: "REG" },
            requestId: `market-reg-${Date.now()}`,
          })
        );
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string) as {
            type?: string;
            timestamp?: number;
            symbol?: string;
            tick?: { c?: number; ch?: number; v?: number; h?: number; l?: number; t?: number };
          };
          if (payload.type === "ping") {
            socket?.send(JSON.stringify({ type: "pong", timestamp: payload.timestamp ?? Date.now() }));
            return;
          }
          if (payload.type !== "tickUpdate" || !payload.symbol || !payload.tick) return;
          const ticker = payload.symbol.toUpperCase();
          const c = payload.tick.c;
          if (typeof c !== "number") return;
          applyTick(
            ticker,
            c,
            typeof payload.tick.ch === "number" ? payload.tick.ch : 0,
            typeof payload.tick.v === "number" ? payload.tick.v : 0,
            typeof payload.tick.t === "number" ? payload.tick.t : Date.now(),
            payload.tick.h,
            payload.tick.l
          );
        } catch {
          // Ignore malformed websocket payloads.
        }
      };

      socket.onclose = () => {
        if (isUnmounted) return;
        setConnectionLabel("reconnecting");
        reconnectAttemptRef.current += 1;
        const waitMs = Math.min(12_000, 1200 * reconnectAttemptRef.current);
        reconnectTimerRef.current = window.setTimeout(connect, waitMs);
      };
    };

    connect();
    return () => {
      isUnmounted = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      socket?.close();
    };
  }, [applyTick]);

  const getQuote = useCallback((ticker: string): LiveQuote | undefined => {
    const key = ticker.toUpperCase();
    const quote = quotesRef.current[key]?.quote;
    if (quote) {
      if (!historyRef.current[key]?.length) void loadHistory(key);
      return quote;
    }
    void ensureQuote(key);
    return undefined;
  }, [ensureQuote, loadHistory]);

  const getStocksWithLive = useCallback((): ReplayStock[] => {
    return profiles.map((profile) => {
      const key = profile.ticker.toUpperCase();
      const quote =
        quotesRef.current[key]?.quote ??
        DEFAULT_QUOTES[key]?.quote ?? {
          price: 0,
          change: 0,
          changePercent: 0,
          volume: 0,
          previousClose: 0,
          date: new Date().toISOString(),
        };
      if (!historyRef.current[key]?.length) void loadHistory(key);
      return { ...profile, ...quote };
    });
  }, [loadHistory, profiles]);

  const getHistory = useCallback((ticker: string): ReplayHistoryPoint[] => {
    const key = ticker.toUpperCase();
    if (!historyRef.current[key]?.length) void loadHistory(key);
    return historyRef.current[key] ?? [];
  }, [loadHistory]);

  const getMarketSnapshot = useCallback((): MarketSnapshot => {
    const stocks = getStocksWithLive().filter((stock) => stock.price > 0);
    const turnoverEstimate = stocks.reduce((sum, stock) => sum + stock.price * stock.volume, 0);
    const advancers = stocks.filter((stock) => stock.changePercent > 0).length;
    const breadth = stocks.length > 0 ? advancers / stocks.length : 0;
    const bySector = new Map<string, number[]>();
    stocks.forEach((stock) => {
      const arr = bySector.get(stock.sector) ?? [];
      arr.push(stock.changePercent);
      bySector.set(stock.sector, arr);
    });
    const sectorLeaders = Array.from(bySector.entries())
      .map(([sector, arr]) => ({
        sector,
        avgChangePercent: Number((arr.reduce((sum, value) => sum + value, 0) / Math.max(1, arr.length)).toFixed(2)),
      }))
      .sort((a, b) => b.avgChangePercent - a.avgChangePercent)
      .slice(0, 3);

    return {
      sessionState: connectionLabel,
      marketBreadth: Number(breadth.toFixed(2)),
      turnoverEstimate: Number(turnoverEstimate.toFixed(2)),
      topGainers: [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5),
      topLosers: [...stocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5),
      sectorLeaders,
      tickId,
      sessionLabel: "Real-time market snapshot",
    };
  }, [connectionLabel, getStocksWithLive, tickId]);

  const estimateExecution = useCallback(
    (ticker: string, side: TradeSide, shares: number): ExecutionEstimate | undefined => {
      const quote = getQuote(ticker);
      if (!quote) return undefined;
      const qty = Math.max(0, Math.floor(shares));
      const notional = qty * quote.price;
      const liquidityFactor = Math.max(1, quote.volume);
      const participation = notional / Math.max(1, liquidityFactor * quote.price);
      const spreadBps = Math.min(28, Math.max(5, 6 + participation * 80));
      const slippageBps = Math.min(42, Math.max(0, participation * 120));
      const priceShift = (spreadBps / 2 + slippageBps) / 10_000;
      const estimatedPrice = side === "BUY" ? quote.price * (1 + priceShift) : quote.price * (1 - priceShift);
      return {
        side,
        estimatedPrice: Number(estimatedPrice.toFixed(2)),
        spreadBps: Number(spreadBps.toFixed(2)),
        slippageBps: Number(slippageBps.toFixed(2)),
        delayMs: 250 + Math.round(Math.random() * 550),
      };
    },
    [getQuote]
  );

  const contextValue = useMemo<PriceContextValue>(
    () => ({
      currentDate: stateTimestamp,
      dataSourceNote: "Live PSX market data from PSX Terminal, used with Perch paper trading execution and portfolio tracking.",
      isPlaceholderData,
      getQuote,
      getStocksWithLive,
      getHistory,
      getMarketSnapshot,
      estimateExecution,
    }),
    [estimateExecution, getHistory, getMarketSnapshot, getQuote, getStocksWithLive, isPlaceholderData, stateTimestamp]
  );

  return createElement(PriceContext.Provider, { value: contextValue }, children);
}

export function usePsxLiveMarket(): PriceContextValue {
  const ctx = useContext(PriceContext);
  if (!ctx) throw new Error("usePsxLiveMarket must be used within PsxLiveMarketProvider");
  return ctx;
}
