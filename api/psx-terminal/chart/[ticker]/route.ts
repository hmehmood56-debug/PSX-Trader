import { NextResponse } from "next/server";
import { PSX_TERMINAL_BASE_URL } from "@/lib/psxTerminalApi";

type ChartRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

type KlineRow = {
  timestamp?: number;
  close?: number;
  volume?: number;
};

/** Upstream allows at most 100 klines per request (PSX Terminal). */
const MAX_KLINES = 100;

const RANGE_CONFIG: Record<
  ChartRange,
  { timeframe: string; windowMs: number | null }
> = {
  // ~25h of 15m bars (100 × 15m)
  "1D": { timeframe: "15m", windowMs: 36 * 60 * 60 * 1000 },
  // ~16d of 4h bars; trim to rolling week window on server
  "1W": { timeframe: "4h", windowMs: 8 * 24 * 60 * 60 * 1000 },
  "1M": { timeframe: "1d", windowMs: 35 * 24 * 60 * 60 * 1000 },
  "3M": { timeframe: "1d", windowMs: 98 * 24 * 60 * 60 * 1000 },
  "1Y": { timeframe: "1d", windowMs: 370 * 24 * 60 * 60 * 1000 },
  ALL: { timeframe: "1d", windowMs: null },
};

function normalizeRows(rows: KlineRow[]): Array<{ date: string; price: number; volume: number }> {
  return rows
    .filter((row) => typeof row.timestamp === "number" && typeof row.close === "number" && Number.isFinite(row.close))
    .map((row) => ({
      date: new Date(row.timestamp as number).toISOString(),
      price: Number((row.close as number).toFixed(2)),
      volume: Math.max(0, Math.round(typeof row.volume === "number" && Number.isFinite(row.volume) ? row.volume : 0)),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function GET(
  request: Request,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase();
  const { searchParams } = new URL(request.url);
  const rawRange = (searchParams.get("range") ?? "1D") as ChartRange;
  const range: ChartRange = rawRange in RANGE_CONFIG ? rawRange : "1D";
  const { timeframe, windowMs } = RANGE_CONFIG[range];

  const klineUrl = `${PSX_TERMINAL_BASE_URL}/api/klines/${encodeURIComponent(ticker)}/${encodeURIComponent(
    timeframe
  )}?limit=${MAX_KLINES}`;

  try {
    const klineResponse = await fetch(klineUrl, { cache: "no-store" });
    if (!klineResponse.ok) {
      const body = await klineResponse.text();
      console.error("[psx-chart] kline upstream failed", {
        ticker,
        range,
        endpoint: klineUrl,
        status: klineResponse.status,
        body: body.slice(0, 400),
      });
      return NextResponse.json(
        { data: [], ticker, range, timeframe, source: "psx-terminal" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const payload = (await klineResponse.json()) as {
      success?: boolean;
      data?: KlineRow[];
    };

    const rawRows = payload.success && Array.isArray(payload.data) ? payload.data : [];
    let points = normalizeRows(rawRows);

    if (windowMs != null && points.length > 0) {
      const cutoff = Date.now() - windowMs;
      const filtered = points.filter((p) => new Date(p.date).getTime() >= cutoff);
      if (filtered.length > 0) points = filtered;
    }

    return NextResponse.json(
      {
        data: points,
        ticker,
        range,
        timeframe,
        source: "psx-terminal",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[psx-chart] unexpected error", {
      ticker,
      range,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { data: [], ticker, range, timeframe, source: "psx-terminal" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
