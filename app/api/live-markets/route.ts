import { NextResponse } from "next/server";
import { TRACKED_CRYPTO_IDS, type LiveMarketAsset } from "@/lib/liveMarkets";

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  market_cap_rank?: number;
  market_cap?: number;
  total_volume?: number;
  last_updated?: string;
};

export async function GET() {
  const params = new URLSearchParams({
    vs_currency: "usd",
    ids: TRACKED_CRYPTO_IDS.join(","),
    order: "market_cap_desc",
    per_page: `${TRACKED_CRYPTO_IDS.length}`,
    page: "1",
    sparkline: "false",
    price_change_percentage: "24h",
  });

  const url = `https://api.coingecko.com/api/v3/coins/markets?${params.toString()}`;

  const demoApiKey = process.env.COINGECKO_DEMO_API_KEY?.trim();
  const headers: HeadersInit = {};

  // CoinGecko supports public requests without an API key.
  // If a demo key exists, we include it to improve reliability
  // without changing the request flow or requiring refactors.
  if (demoApiKey) {
    headers["x-cg-demo-api-key"] = demoApiKey;
  }

  try {
    const response = await fetch(url, {
      headers,
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Unable to fetch live market data from CoinGecko.",
        },
        { status: 502 }
      );
    }

    const raw = (await response.json()) as CoinGeckoMarket[];
    const data: LiveMarketAsset[] = raw.map((coin) => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      price: coin.current_price,
      change24h: coin.price_change_percentage_24h,
      marketCap: coin.market_cap ?? null,
      volume24h: coin.total_volume ?? null,
      rank: coin.market_cap_rank ?? null,
      lastUpdated: coin.last_updated ?? null,
    }));

    return NextResponse.json(
      {
        data,
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        error: "Live market feed is temporarily unavailable.",
      },
      { status: 502 }
    );
  }
}
