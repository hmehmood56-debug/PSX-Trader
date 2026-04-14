import { NextResponse } from "next/server";
import {
  isTrackedCryptoId,
  type LiveMarketDetail,
} from "@/lib/liveMarkets";

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  market_cap?: number;
  market_cap_rank?: number;
  total_volume?: number;
  high_24h?: number;
  low_24h?: number;
  circulating_supply?: number;
  ath?: number;
  ath_change_percentage?: number;
  last_updated?: string;
};

type CoinGeckoChart = {
  prices?: Array<[number, number]>;
};

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  if (!isTrackedCryptoId(id)) {
    return NextResponse.json({ error: "Unsupported crypto asset." }, { status: 404 });
  }

  const demoApiKey = process.env.COINGECKO_DEMO_API_KEY?.trim();
  const headers: HeadersInit = {};

  // Public requests are allowed. If a demo key exists, attach it to
  // improve reliability while keeping this endpoint key-optional.
  if (demoApiKey) {
    headers["x-cg-demo-api-key"] = demoApiKey;
  }

  const marketParams = new URLSearchParams({
    vs_currency: "usd",
    ids: id,
    sparkline: "false",
    price_change_percentage: "24h",
  });

  const summaryUrl = `https://api.coingecko.com/api/v3/coins/markets?${marketParams.toString()}`;
  const chartUrl = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=7&interval=daily`;

  try {
    const [summaryResponse, chartResponse] = await Promise.all([
      fetch(summaryUrl, { headers, next: { revalidate: 0 } }),
      fetch(chartUrl, { headers, next: { revalidate: 0 } }),
    ]);

    if (!summaryResponse.ok || !chartResponse.ok) {
      return NextResponse.json(
        { error: "Unable to fetch crypto detail data." },
        { status: 502 }
      );
    }

    const summaryRaw = (await summaryResponse.json()) as CoinGeckoMarket[];
    const summary = summaryRaw[0];
    if (!summary) {
      return NextResponse.json({ error: "Asset data not found." }, { status: 404 });
    }

    const chartRaw = (await chartResponse.json()) as CoinGeckoChart;
    const chart =
      chartRaw.prices?.map(([ts, price]) => ({
        timestamp: new Date(ts).toISOString(),
        price,
      })) ?? [];

    const data: LiveMarketDetail = {
      id: summary.id,
      symbol: summary.symbol.toUpperCase(),
      name: summary.name,
      price: summary.current_price,
      change24h: summary.price_change_percentage_24h,
      marketCap: summary.market_cap ?? null,
      volume24h: summary.total_volume ?? null,
      rank: summary.market_cap_rank ?? null,
      lastUpdated: summary.last_updated ?? null,
      high24h: summary.high_24h ?? null,
      low24h: summary.low_24h ?? null,
      circulatingSupply: summary.circulating_supply ?? null,
      ath: summary.ath ?? null,
      athChangePercentage: summary.ath_change_percentage ?? null,
      chart,
    };

    return NextResponse.json(
      { data, updatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Crypto detail feed is temporarily unavailable." },
      { status: 502 }
    );
  }
}
