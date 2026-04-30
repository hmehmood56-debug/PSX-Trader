import { NextResponse } from "next/server";
import {
  PSX_TERMINAL_BASE_URL,
  type PsxTerminalTick,
  type PsxTerminalTickResponse,
} from "@/lib/psxTerminalApi";

type MarketSnapshotItem = PsxTerminalTick & { symbol: string };

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

async function fetchKlineFallback(ticker: string): Promise<MarketSnapshotItem | null> {
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
    changePercent: 0,
    volume: typeof row.volume === "number" && Number.isFinite(row.volume) ? row.volume : 0,
    timestamp: row.timestamp,
  };
}

async function fetchTickerSnapshot(ticker: string): Promise<MarketSnapshotItem | null> {
  const url = `${PSX_TERMINAL_BASE_URL}/api/ticks/REG/${encodeURIComponent(ticker)}`;
  const response = await fetchWithRetry(url, 3);
  if (!response || !response.ok) {
    const fallback = await fetchKlineFallback(ticker);
    if (fallback) {
      console.warn("[psx-market] using kline fallback", { ticker });
      return fallback;
    }
    return null;
  }
  const payload = (await response.json()) as PsxTerminalTickResponse;
  if (!payload.success || !payload.data) return null;
  const data = payload.data;
  if (typeof data.price !== "number" || Number.isNaN(data.price)) return null;
  return {
    symbol: ticker,
    market: data.market,
    price: data.price,
    change: data.change,
    changePercent: data.changePercent,
    volume: data.volume,
    high: data.high,
    low: data.low,
    timestamp: data.timestamp,
    value: data.value,
    trades: data.trades,
  };
}

async function fetchAllSymbols(): Promise<string[]> {
  const endpoint = `${PSX_TERMINAL_BASE_URL}/api/symbols`;
  const response = await fetchWithRetry(endpoint, 3);
  if (!response || !response.ok) {
    const body = response ? await response.text() : "";
    console.error("[psx-market] symbols upstream failed", {
      endpoint,
      status: response?.status ?? 0,
      body: body.slice(0, 500),
    });
    return [];
  }
  const payload = (await response.json()) as { success?: boolean; data?: string[] };
  if (!payload.success || !Array.isArray(payload.data)) return [];
  return payload.data
    .filter((symbol) => typeof symbol === "string" && symbol.trim().length > 0)
    .map((symbol) => symbol.toUpperCase());
}

export async function GET() {
  const symbols = await fetchAllSymbols();
  const data: MarketSnapshotItem[] = [];

  const BATCH_SIZE = 25;
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map((ticker) => fetchTickerSnapshot(ticker)));
    settled.forEach((entry) => {
      if (entry.status === "fulfilled" && entry.value) data.push(entry.value);
    });
  }

  if (data.length === 0) {
    return NextResponse.json({ error: "Live market snapshot is temporarily unavailable." }, { status: 502 });
  }

  const degraded = data.length < symbols.length;
  if (degraded) {
    console.warn("[psx-market] degraded snapshot coverage", {
      totalSymbols: symbols.length,
      returned: data.length,
    });
  }

  return NextResponse.json(
    {
      data,
      updatedAt: new Date().toISOString(),
      source: "psx-terminal",
      degraded,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
