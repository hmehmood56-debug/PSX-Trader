import { NextResponse } from "next/server";
import { PSX_TERMINAL_BASE_URL } from "@/lib/psxTerminalApi";

type AllowedStatsType = "REG" | "breadth" | "sectors";

const ALLOWED_TYPES = new Set<AllowedStatsType>(["REG", "breadth", "sectors"]);

export async function GET(_request: Request, context: { params: Promise<{ type: string }> }) {
  const { type } = await context.params;
  if (!ALLOWED_TYPES.has(type as AllowedStatsType)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unsupported stats type.",
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  const endpoint = `${PSX_TERMINAL_BASE_URL}/api/stats/${encodeURIComponent(type)}`;
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) {
      const body = await response.text();
      console.error("[psx-stats] upstream failed", {
        endpoint,
        status: response.status,
        body: body.slice(0, 500),
      });
      return NextResponse.json(
        {
          success: false,
          error: "Stats upstream is temporarily unavailable.",
          timestamp: new Date().toISOString(),
        },
        { status: 502, headers: { "Cache-Control": "public, max-age=5, stale-while-revalidate=15" } }
      );
    }

    const payload = (await response.json()) as { success?: boolean; data?: unknown };
    return NextResponse.json(
      {
        success: payload.success !== false,
        data: payload.data ?? null,
        timestamp: new Date().toISOString(),
        source: "psx-terminal",
      },
      { headers: { "Cache-Control": "public, max-age=5, stale-while-revalidate=15" } }
    );
  } catch (error) {
    console.error("[psx-stats] unexpected error", {
      endpoint,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        success: false,
        error: "Stats endpoint is temporarily unavailable.",
        timestamp: new Date().toISOString(),
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
