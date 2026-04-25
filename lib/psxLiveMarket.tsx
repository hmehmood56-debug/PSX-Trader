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
import { inferPsxListingSector } from "./psxSectorInference";
import {
  getMarketSnapshotUrl,
  getPsxHistoryUrl,
  getPsxQuoteUrl,
  getPsxSymbolsUrl,
} from "./marketSnapshotUrl";
import { PSX_TERMINAL_WS_URL } from "./psxTerminalApi";

export type TradeSide = "BUY" | "SELL";

export type LiveQuote = {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  previousClose: number;
  date: string;
  dayHigh?: number;
  dayLow?: number;
  /** Session rupee turnover when upstream publishes `value`. */
  sessionTurnover?: number;
};

export type ReplayHistoryPoint = {
  date: string;
  price: number;
  volume: number;
};

export type ReplayStock = ReplayStockProfile & LiveQuote & { hasLiveQuote: boolean };

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
};

const CURATED_PROFILES = REPLAY_DATASET.map((item) => item.profile);

const PriceContext = createContext<PriceContextValue | null>(null);

function buildFallbackProfile(ticker: string): ReplayStockProfile {
  const sector = inferPsxListingSector(ticker);
  return {
    ticker,
    name: `${ticker} (PSX)`,
    sector,
    marketCap: 0,
    high52: 0,
    low52: 0,
    description: `KSE-listed equity — ${sector}.`,
  };
}

function normalizeTickTime(timestamp: number): string {
  const ms = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  return new Date(ms).toISOString();
}

function buildLiveQuote(
  price: number,
  change: number,
  volume: number,
  timestamp: number,
  prev?: LiveQuote,
  extras?: { high?: number; low?: number; sessionTurnover?: number }
): LiveQuote {
  const safeChange = Number.isFinite(change) ? change : 0;
  const previousClose = Number.isFinite(price - safeChange) ? Number((price - safeChange).toFixed(2)) : (prev?.previousClose ?? price);
  const changePercent =
    previousClose !== 0
      ? Number((((price - previousClose) / previousClose) * 100).toFixed(2))
      : 0;

  const dayHighCandidate =
    typeof extras?.high === "number" && Number.isFinite(extras.high)
      ? Math.max(extras.high, price)
      : Math.max(prev?.dayHigh ?? price, price);
  const dayLowCandidate =
    typeof extras?.low === "number" && Number.isFinite(extras.low)
      ? Math.min(extras.low, price)
      : Math.min(prev?.dayLow ?? price, price);

  const sessionTurnover =
    typeof extras?.sessionTurnover === "number" &&
    Number.isFinite(extras.sessionTurnover) &&
    extras.sessionTurnover > 0
      ? extras.sessionTurnover
      : prev?.sessionTurnover;

  return {
    price: Number(price.toFixed(2)),
    change: Number(safeChange.toFixed(2)),
    changePercent,
    volume: Math.max(0, Math.round(Number.isFinite(volume) ? volume : 0)),
    previousClose: Number(previousClose.toFixed(2)),
    date: normalizeTickTime(Number.isFinite(timestamp) ? timestamp : Date.now() / 1000),
    dayHigh: dayHighCandidate,
    dayLow: dayLowCandidate,
    sessionTurnover,
  };
}

export function PsxLiveMarketProvider({ children }: { children: ReactNode }) {
  const [tickId, setTickId] = useState(0);
  const [stateTimestamp, setStateTimestamp] = useState(new Date().toISOString());
  const [isPlaceholderData, setIsPlaceholderData] = useState(true);
  const [connectionLabel, setConnectionLabel] = useState("connecting");
  const [profiles, setProfiles] = useState<ReplayStockProfile[]>(CURATED_PROFILES);
  const quotesRef = useRef<Record<string, QuoteState>>({});
  const historyRef = useRef<Record<string, ReplayHistoryPoint[]>>({});
  const historyLoadStateRef = useRef<Record<string, "idle" | "loading" | "loaded" | "unavailable">>({});
  const quoteLoadStateRef = useRef<Record<string, "idle" | "loading" | "loaded" | "unavailable">>({});
  const quoteRetryAfterRef = useRef<Record<string, number>>({});
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);

  const applyTick = useCallback(
    (
      symbol: string,
      price: number,
      change: number,
      volume: number,
      timestamp: number,
      extras?: { high?: number; low?: number; sessionTurnover?: number }
    ) => {
      if (!Number.isFinite(price)) return;
      const ticker = symbol.toUpperCase();
      const prev = quotesRef.current[ticker]?.quote;
      const quote = buildLiveQuote(price, change, volume, timestamp, prev, extras);
      quotesRef.current[ticker] = { quote };
      const history = historyRef.current[ticker] ?? [];
      historyRef.current[ticker] = [...history.slice(-120), { date: quote.date, price: quote.price, volume: quote.volume }];
      setStateTimestamp(new Date().toISOString());
      setTickId((prevId) => prevId + 1);
      setIsPlaceholderData(false);
    },
    []
  );

  const loadSnapshot = useCallback(async () => {
    try {
      const response = await fetch(getMarketSnapshotUrl(), { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        data?: Array<{
          symbol: string;
          price: number;
          change: number;
          volume: number;
          timestamp?: number;
          high?: number;
          low?: number;
          value?: number;
        }>;
      };
      if (!Array.isArray(payload.data) || payload.data.length === 0) return;
      payload.data.forEach((item) => {
        if (typeof item.symbol !== "string" || !Number.isFinite(item.price)) return;
        applyTick(
          item.symbol,
          item.price,
          item.change ?? 0,
          item.volume ?? 0,
          item.timestamp ?? Date.now() / 1000,
          {
            high: item.high,
            low: item.low,
            sessionTurnover: typeof item.value === "number" && item.value > 0 ? item.value : undefined,
          }
        );
      });
      setConnectionLabel("live");
    } catch {
      // Preserve last-known-good quotes in refs.
    }
  }, [applyTick]);

  const ensureQuote = useCallback(
    async (ticker: string) => {
      const key = ticker.toUpperCase();
      if (quotesRef.current[key]?.quote) return;
      if (quoteLoadStateRef.current[key] === "loading") return;
      if (quoteLoadStateRef.current[key] === "unavailable") {
        const next = quoteRetryAfterRef.current[key] ?? 0;
        if (Date.now() < next) return;
      }
      quoteLoadStateRef.current[key] = "loading";
      try {
        const response = await fetch(getPsxQuoteUrl(key), { cache: "no-store" });
        if (!response.ok) {
          quoteLoadStateRef.current[key] = "unavailable";
          quoteRetryAfterRef.current[key] = Date.now() + 25_000;
          return;
        }
        const payload = (await response.json()) as {
          data?: {
            symbol: string;
            price: number;
            change: number;
            volume: number;
            timestamp?: number;
            high?: number;
            low?: number;
            value?: number;
          } | null;
        };
        if (!payload.data || typeof payload.data.price !== "number" || !Number.isFinite(payload.data.price)) {
          quoteLoadStateRef.current[key] = "unavailable";
          quoteRetryAfterRef.current[key] = Date.now() + 25_000;
          return;
        }
        applyTick(
          payload.data.symbol,
          payload.data.price,
          payload.data.change ?? 0,
          payload.data.volume ?? 0,
          payload.data.timestamp ?? Date.now() / 1000,
          {
            high: payload.data.high,
            low: payload.data.low,
            sessionTurnover:
              typeof payload.data.value === "number" && payload.data.value > 0 ? payload.data.value : undefined,
          }
        );
        quoteLoadStateRef.current[key] = "loaded";
      } catch {
        quoteLoadStateRef.current[key] = "unavailable";
        quoteRetryAfterRef.current[key] = Date.now() + 25_000;
      }
    },
    [applyTick]
  );

  const loadHistory = useCallback(async (ticker: string) => {
    const state = historyLoadStateRef.current[ticker] ?? "idle";
    if (state === "loading" || state === "loaded" || state === "unavailable") return;
    historyLoadStateRef.current[ticker] = "loading";
    try {
      const response = await fetch(getPsxHistoryUrl(ticker), { cache: "no-store" });
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
        const response = await fetch(getPsxSymbolsUrl(), { cache: "no-store" });
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
            tick?: {
              c?: number;
              ch?: number;
              v?: number;
              h?: number;
              l?: number;
              t?: number;
              val?: number;
              value?: number;
            };
          };
          if (payload.type === "ping") {
            socket?.send(JSON.stringify({ type: "pong", timestamp: payload.timestamp ?? Date.now() }));
            return;
          }
          if (payload.type !== "tickUpdate" || !payload.symbol || !payload.tick) return;
          const ticker = payload.symbol.toUpperCase();
          const c = payload.tick.c;
          if (typeof c !== "number" || !Number.isFinite(c)) return;
          const ts = typeof payload.tick.t === "number" ? payload.tick.t : Date.now() / 1000;
          const turnover =
            typeof payload.tick.value === "number" && payload.tick.value > 0
              ? payload.tick.value
              : typeof payload.tick.val === "number" && payload.tick.val > 0
                ? payload.tick.val
                : undefined;
          applyTick(
            ticker,
            c,
            typeof payload.tick.ch === "number" ? payload.tick.ch : 0,
            typeof payload.tick.v === "number" ? payload.tick.v : 0,
            ts,
            {
              high: payload.tick.h,
              low: payload.tick.l,
              sessionTurnover: turnover,
            }
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

  const getQuote = useCallback(
    (ticker: string): LiveQuote | undefined => {
      const key = ticker.toUpperCase();
      const quote = quotesRef.current[key]?.quote;
      if (quote) {
        if (!historyRef.current[key]?.length) void loadHistory(key);
        return quote;
      }
      void ensureQuote(key);
      return undefined;
    },
    [ensureQuote, loadHistory]
  );

  const getStocksWithLive = useCallback((): ReplayStock[] => {
    return profiles.map((profile) => {
      const key = profile.ticker.toUpperCase();
      const live = quotesRef.current[key]?.quote;
      const hasLiveQuote = Boolean(live);
      const quote =
        live ??
        ({
          price: 0,
          change: 0,
          changePercent: 0,
          volume: 0,
          previousClose: 0,
          date: new Date().toISOString(),
        } satisfies LiveQuote);
      if (!historyRef.current[key]?.length) void loadHistory(key);
      return { ...profile, ...quote, hasLiveQuote };
    });
  }, [loadHistory, profiles]);

  const getHistory = useCallback(
    (ticker: string): ReplayHistoryPoint[] => {
      const key = ticker.toUpperCase();
      if (!historyRef.current[key]?.length) void loadHistory(key);
      return historyRef.current[key] ?? [];
    },
    [loadHistory]
  );

  const getMarketSnapshot = useCallback((): MarketSnapshot => {
    const stocks = getStocksWithLive().filter((stock) => stock.hasLiveQuote);
    const turnoverEstimate = stocks.reduce((sum, stock) => {
      const t = stock.sessionTurnover;
      if (typeof t === "number" && t > 0) return sum + t;
      return sum + stock.price * stock.volume;
    }, 0);
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
      dataSourceNote:
        "Live Pakistan market data for Perch paper trading execution, portfolio marks, and session analytics.",
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
