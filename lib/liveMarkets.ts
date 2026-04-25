export const TRACKED_CRYPTO_IDS = [
  "bitcoin",
  "ethereum",
  "solana",
  "ripple",
  "binancecoin",
  "cardano",
  "dogecoin",
  "chainlink",
  "avalanche",
  "polkadot",
  "litecoin",
  "tron",
  "toncoin",
  "shiba-inu",
  "polygon",
] as const;

export type TrackedCryptoId = (typeof TRACKED_CRYPTO_IDS)[number];

export type TrackedCryptoConfig = {
  id: TrackedCryptoId;
  symbol: string;
  name: string;
  binanceSymbol: string;
};

const TRACKED_CRYPTO_CONFIG: readonly TrackedCryptoConfig[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", binanceSymbol: "BTCUSDT" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", binanceSymbol: "ETHUSDT" },
  { id: "solana", symbol: "SOL", name: "Solana", binanceSymbol: "SOLUSDT" },
  { id: "ripple", symbol: "XRP", name: "XRP", binanceSymbol: "XRPUSDT" },
  { id: "binancecoin", symbol: "BNB", name: "BNB", binanceSymbol: "BNBUSDT" },
  { id: "cardano", symbol: "ADA", name: "Cardano", binanceSymbol: "ADAUSDT" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", binanceSymbol: "DOGEUSDT" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", binanceSymbol: "LINKUSDT" },
  { id: "avalanche", symbol: "AVAX", name: "Avalanche", binanceSymbol: "AVAXUSDT" },
  { id: "polkadot", symbol: "DOT", name: "Polkadot", binanceSymbol: "DOTUSDT" },
  { id: "litecoin", symbol: "LTC", name: "Litecoin", binanceSymbol: "LTCUSDT" },
  { id: "tron", symbol: "TRX", name: "TRON", binanceSymbol: "TRXUSDT" },
  { id: "toncoin", symbol: "TON", name: "Toncoin", binanceSymbol: "TONUSDT" },
  { id: "shiba-inu", symbol: "SHIB", name: "Shiba Inu", binanceSymbol: "SHIBUSDT" },
  { id: "polygon", symbol: "POL", name: "Polygon", binanceSymbol: "POLUSDT" },
] as const;

const TRACKED_CRYPTO_MAP: ReadonlyMap<TrackedCryptoId, TrackedCryptoConfig> = new Map(
  TRACKED_CRYPTO_CONFIG.map((config) => [config.id, config])
);

export type LiveMarketAsset = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number | null;
  high24h: number | null;
  low24h: number | null;
  marketCap: number | null;
  volume24h: number | null;
  quoteVolume24h: number | null;
  rank: number | null;
  updateTime: string | null;
};

export type LiveMarketDetail = LiveMarketAsset & {
  circulatingSupply: number | null;
  ath: number | null;
  athChangePercentage: number | null;
  chart: Array<{ timestamp: string; price: number }>;
};

export const CHART_RANGES = ["1D", "7D", "1M", "3M", "1Y", "ALL"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

export function isChartRange(value: string): value is ChartRange {
  return (CHART_RANGES as readonly string[]).includes(value);
}

export function isTrackedCryptoId(value: string): value is TrackedCryptoId {
  return (TRACKED_CRYPTO_IDS as readonly string[]).includes(value);
}

export function getTrackedCryptoConfig(id: TrackedCryptoId): TrackedCryptoConfig {
  const config = TRACKED_CRYPTO_MAP.get(id);
  if (!config) {
    throw new Error(`Missing crypto config for ${id}`);
  }
  return config;
}

export function getAllTrackedCryptoConfigs(): readonly TrackedCryptoConfig[] {
  return TRACKED_CRYPTO_CONFIG;
}

export function getTrackedCryptoConfigByBinanceSymbol(
  symbol: string
): TrackedCryptoConfig | null {
  return (
    TRACKED_CRYPTO_CONFIG.find(
      (config) => config.binanceSymbol.toUpperCase() === symbol.toUpperCase()
    ) ?? null
  );
}

export function toCryptoRouteIdFromBinanceSymbol(symbol: string): string {
  const tracked = getTrackedCryptoConfigByBinanceSymbol(symbol);
  if (tracked) return tracked.id;
  return symbol.toLowerCase();
}
