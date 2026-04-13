export const TRACKED_CRYPTO_IDS = [
  "bitcoin",
  "ethereum",
  "solana",
  "binancecoin",
  "ripple",
  "cardano",
  "dogecoin",
  "avalanche-2",
  "polkadot",
  "chainlink",
] as const;

export type TrackedCryptoId = (typeof TRACKED_CRYPTO_IDS)[number];

export type LiveMarketAsset = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number | null;
  marketCap: number | null;
  volume24h: number | null;
  rank: number | null;
  lastUpdated: string | null;
};

export type LiveMarketDetail = LiveMarketAsset & {
  high24h: number | null;
  low24h: number | null;
  circulatingSupply: number | null;
  ath: number | null;
  athChangePercentage: number | null;
  chart: Array<{ timestamp: string; price: number }>;
};

export function isTrackedCryptoId(value: string): value is TrackedCryptoId {
  return (TRACKED_CRYPTO_IDS as readonly string[]).includes(value);
}
