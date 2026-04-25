"use client";

import { useEffect, useMemo, useState } from "react";
import { getPsxStatsUrl } from "@/lib/marketSnapshotUrl";

export type LiveSectorCell = {
  sector: string;
  move: number;
};

type HeatmapCell = LiveSectorCell & {
  meta?: {
    gainers?: number;
    losers?: number;
    totalVolume?: number;
    totalValue?: number;
    totalTrades?: number;
    symbols?: number;
  };
};

type LiveMarketSurfaceProps = {
  initialCells: LiveSectorCell[];
};

type ActivityItem = {
  id: string;
  tone: "buy" | "sell";
  text: string;
  ageSec: number;
  tag?: "High Volume" | "Breakout" | "Price Alert";
  fresh?: boolean;
};

const heatmapLayoutClass: Record<string, string> = {
  Energy: "home-heatmap-cell-energy",
  Banks: "home-heatmap-cell-banks",
  Fertilizer: "home-heatmap-cell-fertilizer",
  Cement: "home-heatmap-cell-cement",
  Tech: "home-heatmap-cell-tech",
  Consumer: "home-heatmap-cell-consumer",
};

const symbols = ["ENGRO", "PSO", "HBL", "MCB", "OGDC", "SYS", "UBL", "FFC"] as const;
const tags: Array<ActivityItem["tag"]> = ["High Volume", "Breakout", "Price Alert"];
const MAX_REAL_SECTOR_CELLS = 8;
const MIN_REAL_SECTOR_CELLS = 6;

type DataMode = "real" | "fallback";

type StatsEnvelope = {
  success?: boolean;
  data?: unknown;
};

type ParsedRegStats = {
  topGainers: ParsedLeader[];
  topLosers: ParsedLeader[];
};

type ParsedBreadthStats = {
  advances?: number;
  declines?: number;
  unchanged?: number;
  advanceDeclineRatio?: number;
  advanceDeclinePercent?: number;
};

type ParsedLeader = {
  symbol: string;
  changePercent?: number;
  volume?: number;
  value?: number;
};

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizePercent(value: any): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const withoutPercent = trimmed.endsWith("%") ? trimmed.slice(0, -1) : trimmed;
    const parsed = Number(withoutPercent.replace(/,/g, "").trim());
    if (!Number.isFinite(parsed)) return null;
    const asPercent = Math.abs(parsed) < 1 ? parsed * 100 : parsed;
    return Math.round(asPercent * 10) / 10;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const asPercent = Math.abs(value) < 1 ? value * 100 : value;
    return Math.round(asPercent * 10) / 10;
  }

  return null;
}

function toSymbol(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const symbol = value.trim().toUpperCase();
  return symbol.length > 0 ? symbol : null;
}

function parseLeader(entry: unknown): ParsedLeader | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Record<string, unknown>;
  const symbol = toSymbol(row.symbol ?? row.ticker ?? row.code ?? row.s);
  if (!symbol) return null;
  return {
    symbol,
    changePercent: toNumber(row.changePercent ?? row.pct ?? row.percentChange ?? row.change_pct),
    volume: toNumber(row.volume ?? row.vol),
    value: toNumber(row.value ?? row.turnover),
  };
}

function parseRegStats(raw: unknown): ParsedRegStats | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const topGainers = Array.isArray(data.topGainers) ? data.topGainers.map(parseLeader).filter(Boolean) as ParsedLeader[] : [];
  const topLosers = Array.isArray(data.topLosers) ? data.topLosers.map(parseLeader).filter(Boolean) as ParsedLeader[] : [];
  return { topGainers, topLosers };
}

function parseBreadthStats(raw: unknown): ParsedBreadthStats | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  return {
    advances: toNumber(data.advances),
    declines: toNumber(data.declines),
    unchanged: toNumber(data.unchanged),
    advanceDeclineRatio: toNumber(data.advanceDeclineRatio),
    advanceDeclinePercent: toNumber(data.advanceDeclinePercent),
  };
}

function parseSectorCells(raw: unknown): HeatmapCell[] {
  if (!raw || typeof raw !== "object") return [];
  const sectors = raw as Record<string, unknown>;

  const parsed = Object.entries(sectors)
    .map(([name, payload]) => {
      if (!payload || typeof payload !== "object") return null;
      const row = payload as Record<string, unknown>;
      const avgChangePercent = normalizePercent(row.avgChangePercent);
      const changePercent = normalizePercent(row.changePercent);
      const avgChange = normalizePercent(row.avgChange);
      const move = avgChangePercent ?? changePercent ?? avgChange;
      if (move === null) return null;
      return {
        sector: name.trim() || "Unknown",
        move: clampMove(move),
        scoreValue: toNumber(row.totalValue) ?? -1,
        scoreVolume: toNumber(row.totalVolume) ?? -1,
        meta: {
          gainers: toNumber(row.gainers),
          losers: toNumber(row.losers),
          totalVolume: toNumber(row.totalVolume),
          totalValue: toNumber(row.totalValue),
          totalTrades: toNumber(row.totalTrades),
          symbols: toNumber(row.symbols),
        },
      };
    })
    .filter(Boolean) as Array<HeatmapCell & { scoreValue: number; scoreVolume: number }>;

  if (parsed.length === 0) return [];

  parsed.sort((a, b) => {
    if (b.scoreValue !== a.scoreValue) return b.scoreValue - a.scoreValue;
    return b.scoreVolume - a.scoreVolume;
  });

  const desiredCount = Math.max(MIN_REAL_SECTOR_CELLS, Math.min(MAX_REAL_SECTOR_CELLS, parsed.length));
  return parsed.slice(0, desiredCount).map(({ scoreValue, scoreVolume, ...cell }) => cell);
}

function formatRelativeAge(seconds: number): string {
  if (seconds <= 2) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const min = Math.floor(seconds / 60);
  return `${min} min ago`;
}

function clampMove(value: number): number {
  return Math.max(-2, Math.min(2, Math.round(value * 10) / 10));
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function LiveMarketSurface({ initialCells }: LiveMarketSurfaceProps) {
  const [cells, setCells] = useState<HeatmapCell[]>(initialCells);
  const [dataMode, setDataMode] = useState<DataMode>("fallback");
  const [regStats, setRegStats] = useState<ParsedRegStats | null>(null);
  const [breadthStats, setBreadthStats] = useState<ParsedBreadthStats | null>(null);
  const [flashSector, setFlashSector] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([
    { id: "seed-1", tone: "buy", text: "ENGRO gaining momentum", ageSec: 2, tag: "High Volume" },
    { id: "seed-2", tone: "sell", text: "HBL under pressure", ageSec: 9, tag: "Price Alert" },
    { id: "seed-3", tone: "buy", text: "Market breadth improving", ageSec: 17 },
    { id: "seed-4", tone: "buy", text: "Gainers leading session", ageSec: 24, tag: "Breakout" },
  ]);

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const [sectorsRes, regRes, breadthRes] = await Promise.allSettled([
          fetch(getPsxStatsUrl("sectors"), { cache: "no-store" }),
          fetch(getPsxStatsUrl("REG"), { cache: "no-store" }),
          fetch(getPsxStatsUrl("breadth"), { cache: "no-store" }),
        ]);

        const parseEnvelope = async (result: PromiseSettledResult<Response>): Promise<StatsEnvelope | null> => {
          if (result.status !== "fulfilled" || !result.value.ok) return null;
          try {
            return (await result.value.json()) as StatsEnvelope;
          } catch {
            return null;
          }
        };

        const [sectorsPayload, regPayload, breadthPayload] = await Promise.all([
          parseEnvelope(sectorsRes),
          parseEnvelope(regRes),
          parseEnvelope(breadthRes),
        ]);

        console.log("[home-heatmap] raw sectors response", sectorsPayload);
        const realCells = sectorsPayload?.success === false ? [] : parseSectorCells(sectorsPayload?.data);
        console.log(
          "[home-heatmap] parsed sector moves",
          realCells.map((cell) => ({ sector: cell.sector, move: cell.move }))
        );
        const parsedReg = regPayload?.success === false ? null : parseRegStats(regPayload?.data);
        const parsedBreadth = breadthPayload?.success === false ? null : parseBreadthStats(breadthPayload?.data);

        if (cancelled) return;

        setRegStats(parsedReg);
        setBreadthStats(parsedBreadth);

        const hasMeaningfulSectorMove = realCells.some((cell) => cell.move !== 0);
        if (realCells.length > 0 && hasMeaningfulSectorMove) {
          setCells(realCells);
          setDataMode("real");
        } else {
          setCells(initialCells);
          setDataMode("fallback");
        }
      } catch {
        if (cancelled) return;
        setCells(initialCells);
        setDataMode("fallback");
      }
    };

    void fetchStats();
    return () => {
      cancelled = true;
    };
  }, [initialCells]);

  useEffect(() => {
    if (dataMode !== "fallback") return;
    let running = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (!running) return;
      setCells((prev) => {
        if (prev.length === 0) return prev;
        const idx = Math.floor(Math.random() * prev.length);
        const next = [...prev];
        const delta = randomBetween(-0.18, 0.22);
        const updated = {
          ...next[idx],
          move: clampMove(next[idx].move + delta),
        };
        next[idx] = updated;
        setFlashSector(updated.sector);
        return next;
      });
      timeoutId = setTimeout(tick, randomBetween(1100, 2800));
    };

    timeoutId = setTimeout(tick, randomBetween(900, 1700));
    return () => {
      running = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [dataMode]);

  useEffect(() => {
    if (!flashSector) return;
    const id = setTimeout(() => setFlashSector(null), 520);
    return () => clearTimeout(id);
  }, [flashSector]);

  useEffect(() => {
    const ageTimer = setInterval(() => {
      setActivity((prev) => prev.map((item) => ({ ...item, ageSec: item.ageSec + 1, fresh: false })));
    }, 1000);
    return () => clearInterval(ageTimer);
  }, []);

  useEffect(() => {
    let running = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const buildFallbackMarketActivityItem = (): ActivityItem => {
      const tone: ActivityItem["tone"] = Math.random() < 0.55 ? "buy" : "sell";
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const sectors = (cells.length > 0 ? cells : initialCells).map((cell) => cell.sector).filter(Boolean);
      const sector = sectors.length > 0 ? sectors[Math.floor(Math.random() * sectors.length)] : "Market";
      const tag = Math.random() < 0.45 ? tags[Math.floor(Math.random() * tags.length)] : undefined;

      const positivePhrases = [
        `${symbol} gaining momentum`,
        `${symbol} seeing high volume`,
        `${sector} sector active`,
        "Market breadth improving",
        "Gainers leading session",
        `${symbol} breakout forming`,
      ];
      const negativePhrases = [
        `${symbol} under pressure`,
        "Selling pressure building",
        `${symbol} pullback continuing`,
        `${sector} sector active`,
      ];
      const pool = tone === "buy" ? positivePhrases : negativePhrases;
      const text = pool[Math.floor(Math.random() * pool.length)];

      return {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tone,
        text,
        ageSec: 0,
        tag,
        fresh: true,
      };
    };

    const buildRealActivityItem = (): ActivityItem | null => {
      const gainers = regStats?.topGainers ?? [];
      const losers = regStats?.topLosers ?? [];
      const realCandidates: ActivityItem[] = [];

      if (gainers.length > 0) {
        const gainer = gainers[Math.floor(Math.random() * gainers.length)];
        realCandidates.push({
          id: `reg-g-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          tone: "buy",
          text: `${gainer.symbol} among top gainers${
            gainer.changePercent !== undefined ? ` (+${gainer.changePercent.toFixed(1)}%)` : ""
          }`,
          ageSec: 0,
          tag: gainer.volume && gainer.volume > 0 ? "High Volume" : undefined,
          fresh: true,
        });
      }

      if (losers.length > 0) {
        const loser = losers[Math.floor(Math.random() * losers.length)];
        realCandidates.push({
          id: `reg-l-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          tone: "sell",
          text: `${loser.symbol} under pressure${
            loser.changePercent !== undefined ? ` (${loser.changePercent.toFixed(1)}%)` : ""
          }`,
          ageSec: 0,
          tag: loser.value && loser.value > 0 ? "Price Alert" : undefined,
          fresh: true,
        });
      }

      if (
        breadthStats &&
        breadthStats.advances !== undefined &&
        breadthStats.declines !== undefined &&
        breadthStats.advances > breadthStats.declines
      ) {
        realCandidates.push({
          id: `br-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          tone: "buy",
          text: "Market breadth improving as advances lead declines",
          ageSec: 0,
          tag: "Breakout",
          fresh: true,
        });
      }

      if (realCandidates.length === 0) return null;
      return realCandidates[Math.floor(Math.random() * realCandidates.length)];
    };

    const spawn = () => {
      if (!running) return;
      setActivity((prev) => {
        if (Math.random() < 0.45) return prev;
        const item = buildRealActivityItem() ?? buildFallbackMarketActivityItem();
        return [item, ...prev].slice(0, 5);
      });
      timeoutId = setTimeout(spawn, randomBetween(1300, 3000));
    };

    timeoutId = setTimeout(spawn, randomBetween(1200, 2400));
    return () => {
      running = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [breadthStats, cells, initialCells, regStats]);

  const orderedCells = useMemo(() => cells, [cells]);
  const heatmapLabel = dataMode === "real" ? "Live PSX market data" : "Sector movement";
  const liveIndicatorLabel = "LIVE";

  return (
    <div className="home-product-preview-body">
      <div className="home-heatmap-head">
        <div>
          <span>Market Heatmap</span>
          <strong>{heatmapLabel}</strong>
        </div>
        <span className="home-live-indicator">
          <i aria-hidden />
          {liveIndicatorLabel}
        </span>
      </div>
      <div className="home-heatmap-grid" role="list" aria-label="Sector movement heatmap">
        {orderedCells.map((cell) => (
          <div
            key={cell.sector}
            className={`home-heatmap-cell ${cell.move >= 0 ? "home-heatmap-cell-up" : "home-heatmap-cell-down"} ${
              heatmapLayoutClass[cell.sector] ?? ""
            } ${flashSector === cell.sector ? "home-heatmap-cell-flash" : ""}`}
            role="listitem"
          >
            <span>{cell.sector}</span>
            <strong>
              {cell.move >= 0 ? "+" : ""}
              {cell.move.toFixed(1)}%
            </strong>
            {cell.meta?.symbols ? (
              <small style={{ opacity: 0.7, fontSize: 10 }}>{Math.round(cell.meta.symbols)} symbols</small>
            ) : null}
          </div>
        ))}
      </div>

      <div className="home-activity-head">
        <h3>Activity Feed</h3>
      </div>
      <ul
        className="home-activity-feed"
        aria-label={dataMode === "real" ? "Recent market activity from PSX stats" : "Recent simulated activity"}
      >
        {activity.map((item, index) => (
          <li
            key={item.id}
            className={`${item.fresh ? "home-activity-item-fresh" : ""} ${index >= 3 ? "home-activity-item-older" : ""}`}
          >
            <span className={`home-activity-icon home-activity-icon-${item.tone}`} aria-hidden>
              {item.tone === "buy" ? "↑" : "↓"}
            </span>
            <span className="home-activity-copy">
              <span>{item.text}</span>
              <small>{formatRelativeAge(item.ageSec)}</small>
            </span>
            {item.tag ? <span className="home-activity-tag">{item.tag}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
