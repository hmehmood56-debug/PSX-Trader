import { NextResponse } from "next/server";
import {
  PSX_TERMINAL_BASE_URL,
  type PsxTerminalTickResponse,
} from "@/lib/psxTerminalApi";

type DailyRow = {
  timestamp?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

export async function GET(
  _request: Request,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase();
  const tickUrl = `${PSX_TERMINAL_BASE_URL}/api/ticks/REG/${encodeURIComponent(ticker)}`;
  const klineUrl = `${PSX_TERMINAL_BASE_URL}/api/klines/${encodeURIComponent(ticker)}/1d?limit=100`;

  let tickPayload: PsxTerminalTickResponse | null = null;
  let dailyRows: DailyRow[] = [];

  try {
    const [tickRes, klineRes] = await Promise.all([
      fetch(tickUrl, { cache: "no-store" }),
      fetch(klineUrl, { cache: "no-store" }),
    ]);

    if (tickRes.ok) {
      tickPayload = (await tickRes.json()) as PsxTerminalTickResponse;
    }

    if (klineRes.ok) {
      const klineJson = (await klineRes.json()) as {
        success?: boolean;
        data?: DailyRow[];
      };
      if (klineJson.success && Array.isArray(klineJson.data)) {
        dailyRows = klineJson.data;
      }
    }
  } catch (error) {
    console.error("[psx-detail-stats] fetch failed", {
      ticker,
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  const tick = tickPayload?.success ? tickPayload.data : undefined;

  let rangeHigh: number | null = null;
  let rangeLow: number | null = null;
  let avgDailyVolume: number | null = null;
  let latestDailyOpen: number | null = null;

  const validDailies = dailyRows.filter(
    (row) =>
      typeof row.high === "number" &&
      Number.isFinite(row.high) &&
      typeof row.low === "number" &&
      Number.isFinite(row.low)
  );

  if (validDailies.length > 0) {
    rangeHigh = Math.max(...validDailies.map((r) => r.high as number));
    rangeLow = Math.min(...validDailies.map((r) => r.low as number));
    const vols = validDailies
      .map((r) => r.volume)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0);
    if (vols.length > 0) {
      avgDailyVolume = vols.reduce((a, b) => a + b, 0) / vols.length;
    }

    const sorted = [...validDailies].sort(
      (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
    );
    const last = sorted[0];
    if (last && typeof last.open === "number" && Number.isFinite(last.open)) {
      latestDailyOpen = last.open;
    }
  }

  return NextResponse.json(
    {
      ticker,
      tick: tick
        ? {
            price: tick.price,
            change: tick.change,
            changePercent: tick.changePercent,
            volume: tick.volume,
            high: tick.high,
            low: tick.low,
            value: tick.value,
            trades: tick.trades,
            timestamp: tick.timestamp,
          }
        : null,
      derived: {
        rangeHigh,
        rangeLow,
        avgDailyVolume,
        latestDailyOpen,
        dailySessions: validDailies.length,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
