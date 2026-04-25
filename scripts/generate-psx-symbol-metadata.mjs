#!/usr/bin/env node

import { writeFile, access } from "node:fs/promises";
import path from "node:path";

const PSX_BASE_URL = "https://psxterminal.com/api";
const DEFAULT_MAX_SYMBOLS = 25;
const DEFAULT_DELAY_MS = 350;
const OUTPUT_FILE = path.resolve(process.cwd(), "lib/psxSymbolMetadata.ts");

function parseArgs(argv) {
  const args = {
    all: false,
    max: DEFAULT_MAX_SYMBOLS,
    symbols: null,
    delayMs: DEFAULT_DELAY_MS,
  };

  for (const raw of argv) {
    if (raw === "--all") {
      args.all = true;
      continue;
    }
    if (raw.startsWith("--max=")) {
      const n = Number(raw.slice("--max=".length));
      if (Number.isFinite(n) && n > 0) args.max = Math.floor(n);
      continue;
    }
    if (raw.startsWith("--delay=")) {
      const n = Number(raw.slice("--delay=".length));
      if (Number.isFinite(n) && n >= 0) args.delayMs = Math.floor(n);
      continue;
    }
    if (raw.startsWith("--symbols=")) {
      const list = raw
        .slice("--symbols=".length)
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      if (list.length > 0) args.symbols = Array.from(new Set(list));
      continue;
    }
  }

  if (args.symbols && args.symbols.length > 0) args.all = false;
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

function toObject(value) {
  return value && typeof value === "object" ? value : null;
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toStringValue(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}`;
  }
  return undefined;
}

function looksLikeReadableSector(value) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return false;
  if (trimmed.length < 3) return false;
  return /[A-Za-z]/.test(trimmed);
}

function buildMetadata(symbol, payload, updatedAt) {
  const root = toObject(payload);
  const data = toObject(root?.data) ?? root;
  const fundamentals = toObject(data?.fundamentals) ?? data;
  if (!fundamentals) return null;

  const rawSector =
    toStringValue(fundamentals.sectorName) ??
    toStringValue(fundamentals.sector_name) ??
    toStringValue(fundamentals.sector) ??
    toStringValue(data.sectorName) ??
    toStringValue(data.sector);

  const metadata = {
    symbol,
    source: "psx-terminal",
    updatedAt,
  };

  if (rawSector) {
    if (looksLikeReadableSector(rawSector)) {
      metadata.sector = rawSector;
    } else {
      metadata.sectorCode = rawSector;
    }
  }

  const listedIn =
    toStringValue(fundamentals.listedIn) ??
    toStringValue(fundamentals.listed_in) ??
    toStringValue(data.listedIn);
  if (listedIn) metadata.listedIn = listedIn;

  const marketCap = toNumber(fundamentals.marketCap) ?? toNumber(fundamentals.market_cap);
  if (marketCap !== undefined) metadata.marketCap = marketCap;

  const freeFloat = toNumber(fundamentals.freeFloat) ?? toNumber(fundamentals.free_float);
  if (freeFloat !== undefined) metadata.freeFloat = freeFloat;

  const dividendYield =
    toNumber(fundamentals.dividendYield) ??
    toNumber(fundamentals.dividend_yield) ??
    toNumber(fundamentals.divYield);
  if (dividendYield !== undefined) metadata.dividendYield = dividendYield;

  const peRatio =
    toNumber(fundamentals.peRatio) ??
    toNumber(fundamentals.pe_ratio) ??
    toNumber(fundamentals.p_e_ratio);
  if (peRatio !== undefined) metadata.peRatio = peRatio;

  const volume30Avg =
    toNumber(fundamentals.volume30Avg) ??
    toNumber(fundamentals.volume_30_avg) ??
    toNumber(fundamentals.avgVolume30d);
  if (volume30Avg !== undefined) metadata.volume30Avg = volume30Avg;

  const isNonCompliantRaw =
    fundamentals.isNonCompliant ??
    fundamentals.is_non_compliant ??
    data.isNonCompliant;
  if (typeof isNonCompliantRaw === "boolean") {
    metadata.isNonCompliant = isNonCompliantRaw;
  }

  const hasUsefulFields = Object.keys(metadata).some(
    (key) => !["symbol", "source", "updatedAt"].includes(key)
  );
  return hasUsefulFields ? metadata : null;
}

function buildFileContent(mapEntries) {
  const metadataObject = JSON.stringify(mapEntries, null, 2);
  return `export type PsxSymbolMetadata = {
  symbol: string;
  sector?: string;
  sectorCode?: string;
  listedIn?: string;
  marketCap?: string | number;
  freeFloat?: string | number;
  dividendYield?: number;
  peRatio?: number;
  volume30Avg?: number;
  isNonCompliant?: boolean;
  source?: "psx-terminal";
  updatedAt?: string;
};

export const PSX_SYMBOL_METADATA: Record<string, PsxSymbolMetadata> = ${metadataObject};

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function looksLikeReadableSector(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^\\d+(\\.\\d+)?$/.test(trimmed)) return false;
  if (trimmed.length < 3) return false;
  return /[A-Za-z]/.test(trimmed);
}

export function getPsxSymbolMetadata(ticker: string): PsxSymbolMetadata | undefined {
  const key = normalizeTicker(ticker);
  if (!key) return undefined;
  return PSX_SYMBOL_METADATA[key];
}

export function getRealSectorForTicker(ticker: string): string | undefined {
  const metadata = getPsxSymbolMetadata(ticker);
  const sector = metadata?.sector?.trim();
  if (!sector) return undefined;
  return looksLikeReadableSector(sector) ? sector : undefined;
}

export function getDisplaySectorForTicker(ticker: string, existingSector?: string): string {
  const realSector = getRealSectorForTicker(ticker);
  if (realSector) return realSector;
  const fallback = existingSector?.trim();
  if (!fallback) return "Unclassified";
  if (fallback.toLowerCase() === "unknown" || fallback.toLowerCase() === "unclassified") {
    return fallback;
  }
  return "Unclassified";
}
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = {
    attempted: 0,
    successes: 0,
    failures: 0,
  };

  let symbols = args.symbols;
  if (!symbols) {
    try {
      const payload = await fetchJson(`${PSX_BASE_URL}/symbols`);
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      symbols = rows
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim().toUpperCase());
      symbols = Array.from(new Set(symbols));
    } catch (error) {
      console.error(`[psx-metadata] failed to fetch symbols: ${error instanceof Error ? error.message : "unknown error"}`);
      process.exitCode = 1;
      return;
    }
  }

  if (!symbols || symbols.length === 0) {
    console.error("[psx-metadata] no symbols to process");
    process.exitCode = 1;
    return;
  }

  const selected = args.symbols
    ? symbols
    : args.all
      ? symbols
      : symbols.slice(0, Math.max(1, args.max));

  const updatedAt = new Date().toISOString();
  const metadataMap = {};

  for (const symbol of selected) {
    summary.attempted += 1;
    const endpoint = `${PSX_BASE_URL}/fundamentals/${encodeURIComponent(symbol)}`;
    let payload = null;
    let attempt = 0;
    while (attempt < 2) {
      try {
        payload = await fetchJson(endpoint);
        break;
      } catch (error) {
        attempt += 1;
        if (attempt >= 2) {
          summary.failures += 1;
          console.warn(`[psx-metadata] ${symbol} failed (${error instanceof Error ? error.message : "unknown error"})`);
        } else {
          await sleep(150);
        }
      }
    }

    if (!payload) {
      if (args.delayMs > 0) await sleep(args.delayMs);
      continue;
    }

    const metadata = buildMetadata(symbol, payload, updatedAt);
    if (metadata) {
      metadataMap[symbol] = metadata;
      summary.successes += 1;
    } else {
      summary.failures += 1;
      console.warn(`[psx-metadata] ${symbol} skipped (no usable metadata fields)`);
    }

    if (args.delayMs > 0) await sleep(args.delayMs);
  }

  if (summary.successes === 0) {
    try {
      await access(OUTPUT_FILE);
      console.warn("[psx-metadata] zero successful symbols; existing metadata file left unchanged");
    } catch {
      const emptyContent = buildFileContent({});
      await writeFile(OUTPUT_FILE, emptyContent, "utf8");
      console.warn("[psx-metadata] zero successful symbols; wrote empty metadata file");
    }
  } else {
    const sorted = Object.fromEntries(
      Object.entries(metadataMap).sort(([a], [b]) => a.localeCompare(b))
    );
    await writeFile(OUTPUT_FILE, buildFileContent(sorted), "utf8");
  }

  console.log("[psx-metadata] generation complete");
  console.log(`- attempted: ${summary.attempted}`);
  console.log(`- successes: ${summary.successes}`);
  console.log(`- failures: ${summary.failures}`);
  console.log(`- output: ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(`[psx-metadata] fatal error: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
