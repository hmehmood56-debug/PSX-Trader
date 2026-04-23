"use client";

import { useEffect, useMemo, useState } from "react";

export type LiveSectorCell = {
  sector: string;
  move: number;
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
  const [cells, setCells] = useState(initialCells);
  const [flashSector, setFlashSector] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([
    { id: "seed-1", tone: "buy", text: "Someone bought ENGRO", ageSec: 2, tag: "High Volume" },
    { id: "seed-2", tone: "sell", text: "Someone sold HBL", ageSec: 9, tag: "Price Alert" },
    { id: "seed-3", tone: "buy", text: "Someone bought OGDC", ageSec: 17 },
    { id: "seed-4", tone: "buy", text: "Someone bought SYS", ageSec: 24, tag: "Breakout" },
  ]);

  useEffect(() => {
    let running = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (!running) return;
      setCells((prev) => {
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
  }, []);

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

    const spawn = () => {
      if (!running) return;
      setActivity((prev) => {
        if (Math.random() < 0.45) return prev;
        const tone: ActivityItem["tone"] = Math.random() < 0.62 ? "buy" : "sell";
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        const tag = Math.random() < 0.45 ? tags[Math.floor(Math.random() * tags.length)] : undefined;
        const item: ActivityItem = {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          tone,
          text: `Someone ${tone === "buy" ? "bought" : "sold"} ${symbol}`,
          ageSec: 0,
          tag,
          fresh: true,
        };
        return [item, ...prev].slice(0, 5);
      });
      timeoutId = setTimeout(spawn, randomBetween(1300, 3000));
    };

    timeoutId = setTimeout(spawn, randomBetween(1200, 2400));
    return () => {
      running = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const orderedCells = useMemo(() => cells, [cells]);

  return (
    <div className="home-product-preview-body">
      <div className="home-heatmap-head">
        <div>
          <span>Market Heatmap</span>
          <strong>Sector movement</strong>
        </div>
        <span className="home-live-indicator">
          <i aria-hidden />
          Live
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
          </div>
        ))}
      </div>

      <div className="home-activity-head">
        <h3>Activity Feed</h3>
      </div>
      <ul className="home-activity-feed" aria-label="Recent simulated activity">
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
