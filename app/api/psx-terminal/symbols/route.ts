import { NextResponse } from "next/server";
import { REPLAY_DATASET } from "@/lib/replayDataset";
import { PSX_TERMINAL_BASE_URL } from "@/lib/psxTerminalApi";

export async function GET() {
  const fallback = Array.from(new Set(REPLAY_DATASET.map((item) => item.profile.ticker.toUpperCase())));
  const endpoint = `${PSX_TERMINAL_BASE_URL}/api/symbols`;

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) {
      const body = await response.text();
      console.error("[psx-symbols] upstream failed", {
        endpoint,
        status: response.status,
        body: body.slice(0, 500),
      });
      return NextResponse.json({ data: fallback, source: "fallback" }, { headers: { "Cache-Control": "no-store" } });
    }

    const payload = (await response.json()) as { success?: boolean; data?: string[] };
    const symbols =
      payload.success && Array.isArray(payload.data)
        ? payload.data
            .filter((symbol) => typeof symbol === "string" && symbol.trim().length > 0)
            .map((symbol) => symbol.toUpperCase())
        : fallback;

    return NextResponse.json(
      { data: Array.from(new Set([...symbols, ...fallback])), source: "psx-terminal" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[psx-symbols] unexpected error", {
      endpoint,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ data: fallback, source: "fallback" }, { headers: { "Cache-Control": "no-store" } });
  }
}
