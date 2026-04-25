import { NextResponse } from "next/server";
import {
  getTrackedCryptoConfigByBinanceSymbol,
  getTrackedCryptoConfig,
  isChartRange,
  isTrackedCryptoId,
  type ChartRange,
  type LiveMarketDetail,
} from "@/lib/liveMarkets";

type BinanceTicker24hr = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  closeTime: number;
};

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string
];

type BinanceExchangeInfo = {
  symbols?: Array<{
    symbol: string;
    status?: string;
    baseAsset?: string;
    quoteAsset?: string;
  }>;
};

const RANGE_TO_KLINES: Record<ChartRange, { interval: string; limit: number }> = {
  "1D": { interval: "15m", limit: 96 },
  "7D": { interval: "1h", limit: 168 },
  "1M": { interval: "4h", limit: 180 },
  "3M": { interval: "12h", limit: 180 },
  "1Y": { interval: "1d", limit: 365 },
  ALL: { interval: "1w", limit: 520 },
};

function resolveBinanceSymbolFromRouteId(id: string): string {
  if (isTrackedCryptoId(id)) {
    return getTrackedCryptoConfig(id).binanceSymbol;
  }
  const normalized = id.toUpperCase();
  return normalized.endsWith("USDT") ? normalized : `${normalized}USDT`;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const requestedRange = new URL(request.url).searchParams.get("range");
  const range: ChartRange =
    requestedRange && isChartRange(requestedRange) ? requestedRange : "1D";
  const rangeConfig = RANGE_TO_KLINES[range];
  const binanceSymbol = resolveBinanceSymbolFromRouteId(id);
  const exchangeInfoUrl = "https://api.binance.us/api/v3/exchangeInfo";
  const exchangeInfoResponse = await fetch(exchangeInfoUrl, {
    next: { revalidate: 300 },
  });
  if (!exchangeInfoResponse.ok) {
    return NextResponse.json(
      { error: "Unable to validate crypto symbol support." },
      { status: 502 }
    );
  }

  const exchangeInfo = (await exchangeInfoResponse.json()) as BinanceExchangeInfo;
  const supported = (exchangeInfo.symbols ?? []).find(
    (symbol) =>
      symbol.symbol === binanceSymbol &&
      symbol.status === "TRADING" &&
      symbol.quoteAsset === "USDT"
  );
  if (!supported?.baseAsset) {
    return NextResponse.json({ error: "Unsupported crypto asset." }, { status: 404 });
  }

  const tracked = getTrackedCryptoConfigByBinanceSymbol(binanceSymbol);
  const routeId = tracked?.id ?? id;
  const displaySymbol = tracked?.symbol ?? supported.baseAsset.toUpperCase();
  const displayName = tracked?.name ?? supported.baseAsset.toUpperCase();
  const binanceSummaryUrl = `https://api.binance.us/api/v3/ticker/24hr?symbol=${binanceSymbol}`;
  const binanceChartUrl = `https://api.binance.us/api/v3/klines?symbol=${binanceSymbol}&interval=${rangeConfig.interval}&limit=${rangeConfig.limit}`;
  const errors: Array<{ endpoint: string; status?: number; body?: string; error?: string }> = [];

  try {
    const [summaryResponse, chartResponse] = await Promise.all([
      fetch(binanceSummaryUrl, { next: { revalidate: 0 } }),
      fetch(binanceChartUrl, { next: { revalidate: 0 } }),
    ]);

    if (summaryResponse.ok && chartResponse.ok) {
      const summary = (await summaryResponse.json()) as BinanceTicker24hr;

      const chartRaw = (await chartResponse.json()) as BinanceKline[];
      const chart = chartRaw.map((kline) => ({
        timestamp: new Date(kline[0]).toISOString(),
        price: Number(kline[4]),
      }));

      const data: LiveMarketDetail = {
        id: routeId,
        symbol: displaySymbol,
        name: displayName,
        price: Number(summary.lastPrice),
        change24h: Number(summary.priceChangePercent),
        high24h: Number(summary.highPrice),
        low24h: Number(summary.lowPrice),
        marketCap: null,
        volume24h: Number(summary.volume),
        quoteVolume24h: Number(summary.quoteVolume),
        rank: null,
        updateTime: new Date(summary.closeTime).toISOString(),
        circulatingSupply: null,
        ath: null,
        athChangePercentage: null,
        chart,
      };

      return NextResponse.json(
        { data, range, updatedAt: new Date().toISOString() },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!summaryResponse.ok) {
      errors.push({
        endpoint: binanceSummaryUrl,
        status: summaryResponse.status,
        body: await summaryResponse.text(),
      });
    }
    if (!chartResponse.ok) {
      errors.push({
        endpoint: binanceChartUrl,
        status: chartResponse.status,
        body: await chartResponse.text(),
      });
    }
  } catch (error) {
    errors.push({
      endpoint: `${binanceSummaryUrl} + ${binanceChartUrl}`,
      error: error instanceof Error ? error.message : "Unknown fetch error",
    });
  }

  for (const entry of errors) {
    console.error("[live-markets/:id] upstream fetch failed", entry);
  }

  return NextResponse.json(
    { error: "Crypto detail feed is temporarily unavailable." },
    { status: 502 }
  );
}
