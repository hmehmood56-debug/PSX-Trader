import { NextResponse } from "next/server";
import { PSX_TERMINAL_BASE_URL, type PsxTerminalTickResponse } from "@/lib/psxTerminalApi";

type KlineResponse = {
  success?: boolean;
  data?: Array<{
    close?: number;
    volume?: number;
    timestamp?: number;
  }>;
};

async function fetchWithRetry(endpoint: string, attempts = 3): Promise<Response | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (response.ok) return response;
      if (response.status >= 500 && attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }
      return response;
    } catch {
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function loadKlineFallback(ticker: string) {
  const endpoint = `${PSX_TERMINAL_BASE_URL}/api/klines/${encodeURIComponent(ticker)}/1m?limit=1`;
  const response = await fetchWithRetry(endpoint, 2);
  if (!response?.ok) return null;
  const payload = (await response.json()) as KlineResponse;
  const row = Array.isArray(payload.data) ? payload.data[0] : undefined;
  if (!row || typeof row.close !== "number" || !Number.isFinite(row.close)) return null;
  return {
    symbol: ticker,
    price: Number(row.close.toFixed(2)),
    change: 0,
    volume: typeof row.volume === "number" && Number.isFinite(row.volume) ? row.volume : 0,
    timestamp: row.timestamp,
    degraded: true as const,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase();
  const endpoint = `${PSX_TERMINAL_BASE_URL}/api/ticks/REG/${encodeURIComponent(ticker)}`;

  try {
    const response = await fetchWithRetry(endpoint, 3);
    if (!response || !response.ok) {
      const fallback = await loadKlineFallback(ticker);
      if (fallback) {
        console.warn("[psx-quote] using kline fallback", { ticker });
        return NextResponse.json(
          { data: fallback, ticker, source: "psx-terminal", degraded: true },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      const body = response ? await response.text() : "";
      console.error("[psx-quote] upstream failed", {
        ticker,
        endpoint,
        status: response?.status ?? 0,
        body: body.slice(0, 500),
      });
      return NextResponse.json(
        { data: null, ticker, source: "psx-terminal" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const payload = (await response.json()) as PsxTerminalTickResponse;
    const tick = payload.success ? payload.data : undefined;
    if (!tick || typeof tick.price !== "number") {
      return NextResponse.json(
        { data: null, ticker, source: "psx-terminal" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        data: {
          symbol: ticker,
          price: tick.price,
          change: tick.change ?? 0,
          volume: tick.volume ?? 0,
          high: tick.high,
          low: tick.low,
          timestamp: tick.timestamp,
          value: tick.value,
          trades: tick.trades,
          changePercent: tick.changePercent,
          degraded: false,
        },
        ticker,
        source: "psx-terminal",
        degraded: false,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const fallback = await loadKlineFallback(ticker);
    if (fallback) {
      console.warn("[psx-quote] using kline fallback after exception", { ticker });
      return NextResponse.json(
        { data: fallback, ticker, source: "psx-terminal", degraded: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("[psx-quote] unexpected error", {
      ticker,
      endpoint,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { data: null, ticker, source: "psx-terminal" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
