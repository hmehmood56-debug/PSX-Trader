import { NextResponse } from "next/server";
import {
  getAllTrackedCryptoConfigs,
  getTrackedCryptoConfigByBinanceSymbol,
  toCryptoRouteIdFromBinanceSymbol,
  type LiveMarketAsset,
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

type BinanceExchangeInfo = {
  symbols?: Array<{
    symbol: string;
    status?: string;
    baseAsset?: string;
    quoteAsset?: string;
  }>;
};

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  high_24h?: number;
  low_24h?: number;
  total_volume?: number;
  last_updated?: string;
};

const COINGECKO_ID_BY_TRACKED_ID: Record<string, string> = {
  bitcoin: "bitcoin",
  ethereum: "ethereum",
  solana: "solana",
  ripple: "ripple",
  binancecoin: "binancecoin",
  cardano: "cardano",
  dogecoin: "dogecoin",
  chainlink: "chainlink",
  avalanche: "avalanche-2",
  polkadot: "polkadot",
  litecoin: "litecoin",
  tron: "tron",
  toncoin: "toncoin",
  "shiba-inu": "shiba-inu",
  polygon: "polygon-ecosystem-token",
};

export async function GET() {
  const tracked = getAllTrackedCryptoConfigs();
  const exchangeInfoUrl = "https://api.binance.us/api/v3/exchangeInfo";
  const allTickersUrl = "https://api.binance.us/api/v3/ticker/24hr";
  const errors: Array<{ endpoint: string; status?: number; body?: string; error?: string }> = [];

  try {
    const exchangeInfoResponse = await fetch(exchangeInfoUrl, {
      next: { revalidate: 0 },
    });

    if (!exchangeInfoResponse.ok) {
      errors.push({
        endpoint: exchangeInfoUrl,
        status: exchangeInfoResponse.status,
        body: await exchangeInfoResponse.text(),
      });
      throw new Error("Binance.US exchangeInfo unavailable");
    }

    const exchangeInfo = (await exchangeInfoResponse.json()) as BinanceExchangeInfo;
    const supportedUsdtPairs = (exchangeInfo.symbols ?? []).filter(
      (symbol) =>
        symbol.status === "TRADING" &&
        symbol.quoteAsset === "USDT" &&
        typeof symbol.baseAsset === "string"
    );
    const supportedSymbolSet = new Set(supportedUsdtPairs.map((pair) => pair.symbol));
    const response = await fetch(allTickersUrl, {
      next: { revalidate: 0 },
    });

    if (response.ok) {
      const raw = (await response.json()) as BinanceTicker24hr[];
      const pairBySymbol = new Map(supportedUsdtPairs.map((pair) => [pair.symbol, pair]));
      const trackedSet = new Set(tracked.map((asset) => asset.binanceSymbol));

      const featuredAssets = raw
        .filter((ticker) => trackedSet.has(ticker.symbol))
        .map((ticker): LiveMarketAsset => {
          const trackedConfig = getTrackedCryptoConfigByBinanceSymbol(ticker.symbol);
          return {
            id: trackedConfig ? trackedConfig.id : toCryptoRouteIdFromBinanceSymbol(ticker.symbol),
            symbol: trackedConfig ? trackedConfig.symbol : ticker.symbol.replace("USDT", ""),
            name: trackedConfig ? trackedConfig.name : ticker.symbol.replace("USDT", ""),
            price: Number(ticker.lastPrice),
            change24h: Number(ticker.priceChangePercent),
            high24h: Number(ticker.highPrice),
            low24h: Number(ticker.lowPrice),
            marketCap: null,
            volume24h: Number(ticker.volume),
            quoteVolume24h: Number(ticker.quoteVolume),
            rank: null,
            updateTime: new Date(ticker.closeTime).toISOString(),
          };
        });

      const broaderAssets = raw
        .filter((ticker) => supportedSymbolSet.has(ticker.symbol))
        .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))
        .slice(0, 250)
        .map((ticker): LiveMarketAsset | null => {
          const pair = pairBySymbol.get(ticker.symbol);
          if (!pair?.baseAsset) return null;
          const trackedConfig = getTrackedCryptoConfigByBinanceSymbol(ticker.symbol);
          return {
            id: trackedConfig ? trackedConfig.id : toCryptoRouteIdFromBinanceSymbol(ticker.symbol),
            symbol: trackedConfig ? trackedConfig.symbol : pair.baseAsset.toUpperCase(),
            name: trackedConfig ? trackedConfig.name : pair.baseAsset.toUpperCase(),
            price: Number(ticker.lastPrice),
            change24h: Number(ticker.priceChangePercent),
            high24h: Number(ticker.highPrice),
            low24h: Number(ticker.lowPrice),
            marketCap: null,
            volume24h: Number(ticker.volume),
            quoteVolume24h: Number(ticker.quoteVolume),
            rank: null,
            updateTime: new Date(ticker.closeTime).toISOString(),
          };
        })
        .filter((item): item is LiveMarketAsset => item !== null);

      const mergedById = new Map<string, LiveMarketAsset>();
      for (const asset of [...broaderAssets, ...featuredAssets]) {
        mergedById.set(asset.id, asset);
      }
      const data = Array.from(mergedById.values());

      return NextResponse.json(
        {
          data,
          featuredIds: tracked.map((asset) => asset.id),
          updatedAt: new Date().toISOString(),
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    if (!response.ok) {
      errors.push({
        endpoint: allTickersUrl,
        status: response.status,
        body: await response.text(),
      });
    }
  } catch (error) {
    errors.push({
      endpoint: exchangeInfoUrl,
      error: error instanceof Error ? error.message : "Unknown fetch error",
    });
  }

  const coinGeckoIds = tracked
    .map((asset) => COINGECKO_ID_BY_TRACKED_ID[asset.id] ?? asset.id)
    .join(",");
  const coinGeckoUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(
    coinGeckoIds
  )}&order=market_cap_desc&per_page=${tracked.length}&page=1&sparkline=false&price_change_percentage=24h`;

  try {
    const response = await fetch(coinGeckoUrl, {
      next: { revalidate: 0 },
    });

    if (response.ok) {
      const raw = (await response.json()) as CoinGeckoMarket[];
      const marketById = new Map(raw.map((coin) => [coin.id, coin]));
      const data = tracked
        .map((asset): LiveMarketAsset | null => {
          const coinGeckoId = COINGECKO_ID_BY_TRACKED_ID[asset.id] ?? asset.id;
          const coin = marketById.get(coinGeckoId);
          if (!coin) return null;
          return {
            id: asset.id,
            symbol: asset.symbol,
            name: asset.name,
            price: coin.current_price,
            change24h: coin.price_change_percentage_24h,
            high24h: coin.high_24h ?? null,
            low24h: coin.low_24h ?? null,
            marketCap: null,
            volume24h: coin.total_volume ?? null,
            quoteVolume24h: null,
            rank: null,
            updateTime: coin.last_updated ?? null,
          };
        })
        .filter((item): item is LiveMarketAsset => item !== null);

      return NextResponse.json(
        {
          data,
          featuredIds: tracked.map((asset) => asset.id),
          updatedAt: new Date().toISOString(),
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    errors.push({
      endpoint: coinGeckoUrl,
      status: response.status,
      body: await response.text(),
    });
  } catch (error) {
    errors.push({
      endpoint: coinGeckoUrl,
      error: error instanceof Error ? error.message : "Unknown fetch error",
    });
  }

  for (const entry of errors) {
    console.error("[live-markets] upstream fetch failed", entry);
  }

  return NextResponse.json(
    {
      error: "Live market feed is temporarily unavailable.",
    },
    { status: 502 }
  );
}
