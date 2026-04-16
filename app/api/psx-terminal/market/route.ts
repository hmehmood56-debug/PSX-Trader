import { NextResponse } from "next/server";
import {
  PSX_TERMINAL_BASE_URL,
  type PsxTerminalTick,
  type PsxTerminalTickResponse,
} from "@/lib/psxTerminalApi";

type MarketSnapshotItem = PsxTerminalTick & { symbol: string };

async function fetchTickerSnapshot(ticker: string): Promise<MarketSnapshotItem | null> {
  const url = `${PSX_TERMINAL_BASE_URL}/api/ticks/REG/${encodeURIComponent(ticker)}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
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
  };
}

async function fetchAllSymbols(): Promise<string[]> {
  const endpoint = `${PSX_TERMINAL_BASE_URL}/api/symbols`;
  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) {
    const body = await response.text();
    console.error("[psx-market] symbols upstream failed", {
      endpoint,
      status: response.status,
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
    return NextResponse.json({ error: "PSX Terminal market snapshot unavailable." }, { status: 502 });
  }

  return NextResponse.json(
    {
      data,
      updatedAt: new Date().toISOString(),
      source: "psx-terminal",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
