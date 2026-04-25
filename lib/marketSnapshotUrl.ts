/**
 * PSX Terminal proxy: Cloudflare Worker when `NEXT_PUBLIC_MARKET_API_BASE` is set (no trailing slash),
 * otherwise same-origin `/api/psx-terminal/*` routes on Vercel.
 */
const FALLBACK_PREFIX = "/api/psx-terminal";
export type PsxStatsType = "REG" | "breadth" | "sectors";

function workerBase(): string | null {
  const base = (process.env.NEXT_PUBLIC_MARKET_API_BASE ?? "").trim().replace(/\/$/, "");
  return base || null;
}

export function getMarketSnapshotUrl(): string {
  const base = workerBase();
  if (base) return `${base}/market`;
  return `${FALLBACK_PREFIX}/market`;
}

export function getPsxSymbolsUrl(): string {
  const base = workerBase();
  if (base) return `${base}/symbols`;
  return `${FALLBACK_PREFIX}/symbols`;
}

export function getPsxQuoteUrl(ticker: string): string {
  const t = encodeURIComponent(ticker);
  const base = workerBase();
  if (base) return `${base}/quote?ticker=${t}`;
  return `${FALLBACK_PREFIX}/quote/${t}`;
}

export function getPsxHistoryUrl(ticker: string): string {
  const t = encodeURIComponent(ticker);
  const base = workerBase();
  if (base) return `${base}/history?ticker=${t}`;
  return `${FALLBACK_PREFIX}/history/${t}`;
}

export function getPsxChartUrl(ticker: string, range: string): string {
  const t = encodeURIComponent(ticker);
  const r = encodeURIComponent(range);
  const base = workerBase();
  if (base) return `${base}/chart?ticker=${t}&range=${r}`;
  return `${FALLBACK_PREFIX}/chart/${t}?range=${r}`;
}

export function getPsxStatsUrl(type: PsxStatsType): string {
  const t = encodeURIComponent(type);
  const base = workerBase();
  if (base) return `${base}/stats/${t}`;
  return `${FALLBACK_PREFIX}/stats/${t}`;
}
