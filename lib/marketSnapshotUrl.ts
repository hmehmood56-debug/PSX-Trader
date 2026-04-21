/**
 * Live PSX market snapshot: Cloudflare Worker when configured, otherwise the Vercel API route.
 * Set `NEXT_PUBLIC_MARKET_API_BASE` to your worker origin (no trailing slash), e.g. https://psx-market.xxx.workers.dev
 */
export function getMarketSnapshotUrl(): string {
  const base = (process.env.NEXT_PUBLIC_MARKET_API_BASE ?? "").trim().replace(/\/$/, "");
  if (base) return `${base}/market`;
  return "/api/psx-terminal/market";
}
