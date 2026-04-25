import { NextResponse } from "next/server";
import {
  PSX_TERMINAL_BASE_URL,
  type PsxTerminalKline,
  type PsxTerminalKlineResponse,
  type PsxTerminalTickResponse,
} from "@/lib/psxTerminalApi";

function normalizeRows(rows: PsxTerminalKline[]): Array<{ date: string; price: number; volume: number }> {
  return rows
    .filter((row) => Number.isFinite(row.timestamp) && Number.isFinite(row.close))
    .map((row) => ({
      date: new Date(row.timestamp).toISOString(),
      price: Number(row.close.toFixed(2)),
      volume: Math.max(0, Math.round(row.volume || 0)),
    }));
}

export async function GET(
  _request: Request,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase();
  try {
    const klineUrl = `${PSX_TERMINAL_BASE_URL}/api/klines/${encodeURIComponent(ticker)}/1m?limit=70`;
    const klineResponse = await fetch(klineUrl, { cache: "no-store" });
    if (!klineResponse.ok) {
      const klineBody = await klineResponse.text();
      console.error("[psx-detail-history] kline upstream failed", {
        ticker,
        endpoint: klineUrl,
        status: klineResponse.status,
        body: klineBody.slice(0, 500),
      });

      if (klineResponse.status === 404) {
        return NextResponse.json(
          { data: [], source: "psx-terminal", ticker },
          { headers: { "Cache-Control": "no-store" } }
        );
      }

      const tickUrl = `${PSX_TERMINAL_BASE_URL}/api/ticks/REG/${encodeURIComponent(ticker)}`;
      const tickResponse = await fetch(tickUrl, { cache: "no-store" });
      if (!tickResponse.ok) {
        const tickBody = await tickResponse.text();
        console.error("[psx-detail-history] tick upstream fallback failed", {
          ticker,
          endpoint: tickUrl,
          status: tickResponse.status,
          body: tickBody.slice(0, 500),
        });
        return NextResponse.json(
          { data: [], source: "psx-terminal", ticker },
          { headers: { "Cache-Control": "no-store" } }
        );
      }

      const tickPayload = (await tickResponse.json()) as PsxTerminalTickResponse;
      const tickData = tickPayload.success ? tickPayload.data : undefined;
      if (!tickData || typeof tickData.price !== "number") {
        console.error("[psx-detail-history] tick fallback payload invalid", {
          ticker,
          endpoint: tickUrl,
          status: tickResponse.status,
          body: JSON.stringify(tickPayload).slice(0, 500),
        });
        return NextResponse.json(
          { data: [], source: "psx-terminal", ticker },
          { headers: { "Cache-Control": "no-store" } }
        );
      }

      const ts = typeof tickData.timestamp === "number" ? tickData.timestamp * 1000 : Date.now();
      return NextResponse.json(
        {
          data: [
            {
              date: new Date(ts).toISOString(),
              price: Number(tickData.price.toFixed(2)),
              volume: Math.max(0, Math.round(tickData.volume ?? 0)),
            },
          ],
          source: "psx-terminal",
          ticker,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const payload = (await klineResponse.json()) as PsxTerminalKlineResponse;
    const rows =
      payload.success && Array.isArray(payload.data)
        ? payload.data
            .filter((row) => typeof row.timestamp === "number" && typeof row.close === "number")
            .map(
              (row): PsxTerminalKline => ({
                timestamp: row.timestamp as number,
                close: row.close as number,
                volume: typeof row.volume === "number" ? row.volume : 0,
              })
            )
        : [];

    if (rows.length === 0) {
      console.error("[psx-detail-history] kline payload empty", {
        ticker,
        endpoint: klineUrl,
        status: klineResponse.status,
        body: JSON.stringify(payload).slice(0, 500),
      });
    }

    return NextResponse.json(
      {
        data: normalizeRows(rows),
        source: "psx-terminal",
        ticker,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[psx-detail-history] unexpected history failure", {
      ticker,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { data: [], source: "psx-terminal", ticker },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
