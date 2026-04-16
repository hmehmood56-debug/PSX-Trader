import { NextResponse } from "next/server";
import { PSX_TERMINAL_BASE_URL, type PsxTerminalTickResponse } from "@/lib/psxTerminalApi";

export async function GET(
  _request: Request,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase();
  const endpoint = `${PSX_TERMINAL_BASE_URL}/api/ticks/REG/${encodeURIComponent(ticker)}`;

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) {
      const body = await response.text();
      console.error("[psx-quote] upstream failed", {
        ticker,
        endpoint,
        status: response.status,
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
        },
        ticker,
        source: "psx-terminal",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
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
