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
import { REPLAY_DATASET, type ReplayBar, type ReplayStockProfile } from "./replayDataset";
import { CURRENT_MARKET_SEED, getSeedForTicker } from "./marketSeed";

export type SessionState = "bullish" | "bearish" | "neutral" | "volatile" | "defensive" | "risk-on";
export type SimSector = "banking" | "oil_gas" | "fertilizer" | "cement" | "utilities" | "technology";
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

export type StockPersonality = {
  baselineVolatility: number;
  liquidityScore: number;
  momentumTendency: number;
  sectorSensitivity: number;
  meanReversionTendency: number;
};

export type ReplayStock = ReplayStockProfile &
  LiveQuote & {
    sectorKey: SimSector;
    personality: StockPersonality;
  };

type StockCalibration = {
  avgAbsReturn: number;
  typicalMove: number;
  dailyRange: number;
  avgVolume: number;
};

type StockState = {
  ticker: string;
  profile: ReplayStockProfile;
  personality: StockPersonality;
  sector: SimSector;
  calibration: StockCalibration;
  price: number;
  previousClose: number;
  dayOpen: number;
  volume: number;
  trendMemory: number;
  prevMove: number;
  history: ReplayHistoryPoint[];
};

type SectorSnapshot = {
  sector: SimSector;
  avgChangePercent: number;
};

export type MarketSnapshot = {
  sessionState: SessionState;
  marketBreadth: number;
  turnoverEstimate: number;
  topGainers: ReplayStock[];
  topLosers: ReplayStock[];
  sectorLeaders: SectorSnapshot[];
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

type PerchSimContextValue = {
  currentDate: string;
  dataSourceNote: string;
  isPlaceholderData: boolean;
  getQuote: (ticker: string) => LiveQuote | undefined;
  getStocksWithLive: () => ReplayStock[];
  getHistory: (ticker: string) => ReplayHistoryPoint[];
  getMarketSnapshot: () => MarketSnapshot;
  estimateExecution: (ticker: string, side: TradeSide, shares: number) => ExecutionEstimate | undefined;
};

const SESSION_INTERVAL_MS = 2200;

const REGIME_PARAMS: Record<SessionState, { drift: number; volMultiplier: number; breadthBias: number }> = {
  bullish: { drift: 0.0012, volMultiplier: 0.9, breadthBias: 0.18 },
  bearish: { drift: -0.0012, volMultiplier: 1, breadthBias: -0.18 },
  neutral: { drift: 0.0001, volMultiplier: 0.75, breadthBias: 0 },
  volatile: { drift: 0, volMultiplier: 1.5, breadthBias: 0 },
  defensive: { drift: 0.0002, volMultiplier: 0.6, breadthBias: 0.05 },
  "risk-on": { drift: 0.0016, volMultiplier: 1.25, breadthBias: 0.12 },
};

const SECTOR_MAP: Record<string, SimSector> = {
  Banking: "banking",
  Energy: "oil_gas",
  Cement: "cement",
  Power: "utilities",
  Technology: "technology",
  Conglomerate: "fertilizer",
  Pharmaceuticals: "utilities",
};

const SECTOR_LABEL: Record<SimSector, string> = {
  banking: "Banking",
  oil_gas: "Oil & Gas",
  fertilizer: "Fertilizer",
  cement: "Cement",
  utilities: "Utilities",
  technology: "Technology",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function randomNormal(): number {
  const u = Math.max(Math.random(), 1e-8);
  const v = Math.max(Math.random(), 1e-8);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function toSector(profile: ReplayStockProfile): SimSector {
  return SECTOR_MAP[profile.sector] ?? "utilities";
}

function deriveCalibration(bars: ReplayBar[]): StockCalibration {
  const returns: number[] = [];
  for (let i = 1; i < bars.length; i += 1) {
    const prev = bars[i - 1].close;
    const current = bars[i].close;
    if (prev > 0) returns.push((current - prev) / prev);
  }
  const avgAbsReturn =
    returns.length > 0 ? returns.reduce((sum, r) => sum + Math.abs(r), 0) / returns.length : 0.008;
  const avgVolume = bars.reduce((sum, b) => sum + b.volume, 0) / Math.max(1, bars.length);
  const dailyRange = clamp(avgAbsReturn * 2.4, 0.008, 0.08);

  return {
    avgAbsReturn,
    typicalMove: clamp(avgAbsReturn * 1.2, 0.0015, 0.03),
    dailyRange,
    avgVolume,
  };
}

function derivePersonality(profile: ReplayStockProfile, calibration: StockCalibration): StockPersonality {
  const capScale = clamp(Math.log10(Math.max(10_000_000, profile.marketCap)) / 12, 0.3, 1);
  const liquidityScore = clamp(
    Math.log10(Math.max(10_000, calibration.avgVolume)) / 7 + capScale * 0.35,
    0.15,
    1
  );
  const baselineVolatility = clamp(calibration.typicalMove * (1.3 - liquidityScore * 0.5), 0.0015, 0.035);

  return {
    baselineVolatility,
    liquidityScore,
    momentumTendency: clamp(0.35 + (1 - liquidityScore) * 0.35 + Math.random() * 0.2, 0.2, 0.9),
    sectorSensitivity: clamp(0.7 + capScale * 0.35 + Math.random() * 0.2, 0.6, 1.3),
    meanReversionTendency: clamp(0.15 + liquidityScore * 0.55, 0.2, 0.8),
  };
}

function toLiveQuote(state: StockState, nowIso: string): LiveQuote {
  const change = state.price - state.previousClose;
  const changePercent = state.previousClose !== 0 ? (change / state.previousClose) * 100 : 0;
  return {
    price: round2(state.price),
    change: round2(change),
    changePercent: round2(changePercent),
    volume: Math.round(state.volume),
    previousClose: round2(state.previousClose),
    date: nowIso,
  };
}

function buildInitialState(): Record<string, StockState> {
  const state: Record<string, StockState> = {};
  for (const item of REPLAY_DATASET) {
    const bars = item.bars;
    const latest = bars[bars.length - 1];
    const previous = bars[bars.length - 2] ?? latest;
    const calibration = deriveCalibration(bars);
    const personality = derivePersonality(item.profile, calibration);
    const sector = toSector(item.profile);
    const seed = getSeedForTicker(item.profile.ticker);
    const anchor = seed?.price ?? latest.close;
    const previousAnchor = seed?.previousClose ?? previous.close;
    const scale = latest.close > 0 ? anchor / latest.close : 1;
    const seedHistory = bars.slice(-6).map((bar) => ({
      date: `${bar.date}T09:30:00.000Z`,
      price: round2(Math.max(1, bar.close * scale)),
      volume: bar.volume,
    }));

    state[item.profile.ticker] = {
      ticker: item.profile.ticker,
      profile: item.profile,
      personality,
      sector,
      calibration,
      price: round2(anchor),
      previousClose: round2(Math.max(1, previousAnchor)),
      dayOpen: round2(anchor),
      volume: Math.round(seed?.volumeEstimate ?? calibration.avgVolume * (0.65 + Math.random() * 0.5)),
      trendMemory: 0,
      prevMove: 0,
      history: seedHistory,
    };
  }
  return state;
}

const PerchSimContext = createContext<PerchSimContextValue | null>(null);

export function PerchSimEngineProvider({ children }: { children: ReactNode }) {
  const stateRef = useRef<Record<string, StockState>>(buildInitialState());
  const [tickId, setTickId] = useState(0);
  const [sessionState, setSessionState] = useState<SessionState>("neutral");
  const sessionStateRef = useRef<SessionState>("neutral");
  const [stateTimestamp, setStateTimestamp] = useState(() => new Date().toISOString());
  const regimeTicksLeftRef = useRef(18);
  const sectorDriftRef = useRef<Record<SimSector, number>>({
    banking: 0,
    oil_gas: 0,
    fertilizer: 0,
    cement: 0,
    utilities: 0,
    technology: 0,
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      setTickId((prev) => prev + 1);
    }, SESSION_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (tickId === 0) return;

    regimeTicksLeftRef.current -= 1;
    if (regimeTicksLeftRef.current <= 0) {
      const regimes = Object.keys(REGIME_PARAMS) as SessionState[];
      const next = regimes[Math.floor(Math.random() * regimes.length)];
      sessionStateRef.current = next;
      setSessionState(next);
      regimeTicksLeftRef.current = 14 + Math.floor(Math.random() * 14);
    }

    const nextSectorDrift = { ...sectorDriftRef.current };
    (Object.keys(nextSectorDrift) as SimSector[]).forEach((sector) => {
      nextSectorDrift[sector] = clamp(nextSectorDrift[sector] * 0.82 + randomNormal() * 0.00045, -0.0045, 0.0045);
    });
    sectorDriftRef.current = nextSectorDrift;

    const nowIso = new Date().toISOString();
    const params = REGIME_PARAMS[sessionStateRef.current];
    const stocks = stateRef.current;
    const tickWithinSession = tickId % 45;
    const sessionReset = tickWithinSession === 0;

    Object.values(stocks).forEach((stock) => {
      const regimeDrift = params.drift;
      const sectorMove = sectorDriftRef.current[stock.sector] * stock.personality.sectorSensitivity;
      const trendInfluence = stock.trendMemory * stock.personality.momentumTendency * 0.33;
      const reversionInfluence =
        ((stock.dayOpen - stock.price) / Math.max(1, stock.dayOpen)) *
        stock.personality.meanReversionTendency *
        0.08;
      const noise = randomNormal() * stock.personality.baselineVolatility * params.volMultiplier;

      const rawMove = regimeDrift + sectorMove + trendInfluence + reversionInfluence + noise;
      const smoothedMove = stock.prevMove * 0.45 + rawMove * 0.55;
      const boundedMove = clamp(smoothedMove, -stock.calibration.dailyRange, stock.calibration.dailyRange);
      const nextPrice = Math.max(1, stock.price * (1 + boundedMove));
      const moveAbs = Math.abs(boundedMove);

      const tickVolume =
        stock.calibration.avgVolume *
        (0.015 + moveAbs * 7.5) *
        (0.55 + stock.personality.liquidityScore) *
        (1 + Math.random() * 0.3);

      stock.price = round2(nextPrice);
      stock.volume = Math.max(1, Math.round(stock.volume + tickVolume));
      stock.trendMemory = clamp(stock.trendMemory * 0.6 + boundedMove * 0.4, -0.03, 0.03);
      stock.prevMove = boundedMove;
      stock.history = [...stock.history.slice(-69), { date: nowIso, price: stock.price, volume: stock.volume }];

      if (sessionReset) {
        stock.previousClose = stock.price;
        stock.dayOpen = stock.price;
        stock.volume = Math.round(stock.calibration.avgVolume * (0.4 + Math.random() * 0.5));
        stock.trendMemory = stock.trendMemory * 0.2;
        stock.prevMove = stock.prevMove * 0.25;
      }
    });

    setStateTimestamp(nowIso);
  }, [tickId]);

  const getQuote = useCallback(
    (ticker: string): LiveQuote | undefined => {
      const item = stateRef.current[ticker.toUpperCase()];
      return item ? toLiveQuote(item, stateTimestamp) : undefined;
    },
    [stateTimestamp]
  );

  const getStocksWithLive = useCallback((): ReplayStock[] => {
    return Object.values(stateRef.current).map((stock) => {
      const quote = toLiveQuote(stock, stateTimestamp);
      return {
        ...stock.profile,
        sector: SECTOR_LABEL[stock.sector],
        ...quote,
        sectorKey: stock.sector,
        personality: stock.personality,
      };
    });
  }, [stateTimestamp]);

  const getHistory = useCallback((ticker: string): ReplayHistoryPoint[] => {
    const item = stateRef.current[ticker.toUpperCase()];
    return item ? item.history : [];
  }, []);

  const getMarketSnapshot = useCallback((): MarketSnapshot => {
    const stocks = getStocksWithLive();
    const turnoverEstimate = stocks.reduce((sum, stock) => sum + stock.price * stock.volume, 0);
    const advancers = stocks.filter((stock) => stock.changePercent > 0).length;
    const breadth = stocks.length > 0 ? advancers / stocks.length : 0;

    const sectorBuckets: Record<SimSector, number[]> = {
      banking: [],
      oil_gas: [],
      fertilizer: [],
      cement: [],
      utilities: [],
      technology: [],
    };

    stocks.forEach((stock) => {
      sectorBuckets[stock.sectorKey].push(stock.changePercent);
    });

    const sectorLeaders = (Object.keys(sectorBuckets) as SimSector[])
      .map((sector) => {
        const arr = sectorBuckets[sector];
        const avgChangePercent = arr.length > 0 ? arr.reduce((sum, v) => sum + v, 0) / arr.length : 0;
        return { sector, avgChangePercent: round2(avgChangePercent) };
      })
      .sort((a, b) => b.avgChangePercent - a.avgChangePercent)
      .slice(0, 3);

    return {
      sessionState,
      marketBreadth: round2(breadth),
      turnoverEstimate: round2(turnoverEstimate),
      topGainers: [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5),
      topLosers: [...stocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5),
      sectorLeaders,
      tickId,
      sessionLabel: `Simulated market session #${Math.floor(tickId / 45) + 1}`,
    };
  }, [getStocksWithLive, sessionState, tickId]);

  const estimateExecution = useCallback(
    (ticker: string, side: TradeSide, shares: number): ExecutionEstimate | undefined => {
      const state = stateRef.current[ticker.toUpperCase()];
      if (!state) return undefined;

      const qty = Math.max(0, Math.floor(shares));
      const quote = toLiveQuote(state, stateTimestamp);
      const orderNotional = qty * quote.price;
      const liquidityPenalty = 1 - state.personality.liquidityScore;
      const spreadBps = clamp(6 + liquidityPenalty * 22 + state.personality.baselineVolatility * 650, 4, 36);
      const volumeImpactBase = orderNotional / Math.max(1, state.calibration.avgVolume * quote.price);
      const slippageBps = clamp(volumeImpactBase * 140 + liquidityPenalty * 8, 0, 45);
      const directionBps = (spreadBps / 2 + slippageBps) / 10_000;
      const estimatedPrice = side === "BUY" ? quote.price * (1 + directionBps) : quote.price * (1 - directionBps);

      return {
        side,
        estimatedPrice: round2(estimatedPrice),
        spreadBps: round2(spreadBps),
        slippageBps: round2(slippageBps),
        delayMs: 350 + Math.round(Math.random() * 900),
      };
    },
    [stateTimestamp]
  );

  const contextValue = useMemo<PerchSimContextValue>(
    () => ({
      currentDate: stateTimestamp,
      dataSourceNote:
        `Powered by Perch Sim Engine. Seeded from current PSX anchors (${CURRENT_MARKET_SEED.asOf}), then simulated forward with calibrated behavior.`,
      isPlaceholderData: false,
      getQuote,
      getStocksWithLive,
      getHistory,
      getMarketSnapshot,
      estimateExecution,
    }),
    [estimateExecution, getHistory, getMarketSnapshot, getQuote, getStocksWithLive, stateTimestamp]
  );

  return createElement(PerchSimContext.Provider, { value: contextValue }, children);
}

export function usePerchSimEngine(): PerchSimContextValue {
  const ctx = useContext(PerchSimContext);
  if (!ctx) throw new Error("usePerchSimEngine must be used within PerchSimEngineProvider");
  return ctx;
}
