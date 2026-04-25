#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_LIMIT = 100;
const DEFAULT_DELAY_MS = 300;
const TICKER_DOMAIN_MAP_FILE = path.resolve(process.cwd(), "lib/tickerDomainMap.ts");
const OUTPUT_JSON_FILE = path.resolve(process.cwd(), "data/logo-domain-candidates.json");
const SOURCE_BASE_URL = "https://dps.psx.com.pk/company";
const SYMBOLS_ENDPOINT = "https://soft-resonance-1d40.hmehmood56.workers.dev/symbols";

function parseArgs(argv) {
  const args = {
    all: false,
    limit: DEFAULT_LIMIT,
    delayMs: DEFAULT_DELAY_MS,
    symbols: null,
    force: false,
  };

  for (const raw of argv) {
    if (raw === "--all") {
      args.all = true;
      continue;
    }
    if (raw === "--force") {
      args.force = true;
      continue;
    }
    if (raw.startsWith("--limit=")) {
      const parsed = Number(raw.slice("--limit=".length));
      if (Number.isFinite(parsed) && parsed > 0) {
        args.limit = Math.floor(parsed);
      }
      continue;
    }
    if (raw.startsWith("--delay=")) {
      const parsed = Number(raw.slice("--delay=".length));
      if (Number.isFinite(parsed) && parsed >= 0) {
        args.delayMs = Math.floor(parsed);
      }
      continue;
    }
    if (raw.startsWith("--symbols=")) {
      const list = raw
        .slice("--symbols=".length)
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      if (list.length > 0) {
        args.symbols = Array.from(new Set(list));
      }
      continue;
    }
  }

  if (args.symbols && args.symbols.length > 0) {
    args.all = false;
  }

  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseTickerKeysFromDomainMap(content) {
  const keys = new Set();
  const keyRegex = /^\s{2}([A-Z0-9]+):\s*["']/gm;
  let match = keyRegex.exec(content);
  while (match) {
    keys.add(match[1]);
    match = keyRegex.exec(content);
  }
  return keys;
}

function normalizeTickerValue(value) {
  if (typeof value !== "string") return null;
  const ticker = value.trim().toUpperCase();
  if (!ticker) return null;
  if (!/^[A-Z0-9]+$/.test(ticker)) return null;
  return ticker;
}

function parseSymbolsPayload(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray(payload.data)
      ? payload.data
      : [];
  if (!Array.isArray(rows)) return [];
  const symbols = [];

  for (const item of rows) {
    if (typeof item === "string") {
      const ticker = normalizeTickerValue(item);
      if (ticker) symbols.push(ticker);
      continue;
    }

    if (item && typeof item === "object") {
      const ticker = normalizeTickerValue(item.ticker) ?? normalizeTickerValue(item.symbol);
      if (ticker) symbols.push(ticker);
    }
  }

  return Array.from(new Set(symbols)).sort((a, b) => a.localeCompare(b));
}

async function fetchAllSymbols() {
  const response = await fetch(SYMBOLS_ENDPOINT, {
    headers: {
      Accept: "application/json",
      "User-Agent": "psx-logo-domain-candidates-script/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  const symbols = parseSymbolsPayload(payload);
  if (symbols.length === 0) {
    throw new Error("no symbols in response");
  }
  return symbols;
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2f;|&#47;/gi, "/");
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, " ");
}

function extractWebsiteRawCandidates(html) {
  const candidates = [];

  const anchorNearLabel =
    /<(?:div|td|th|dt|span|strong|b)[^>]*>\s*web[\s-]*site\s*<\/(?:div|td|th|dt|span|strong|b)>[\s\S]{0,400}?<a[^>]*href=["']([^"']+)["']/gi;
  let match = anchorNearLabel.exec(html);
  while (match) {
    candidates.push(match[1]);
    match = anchorNearLabel.exec(html);
  }

  const urlNearLabel =
    /<(?:div|td|th|dt|span|strong|b)[^>]*>\s*web[\s-]*site\s*<\/(?:div|td|th|dt|span|strong|b)>[\s\S]{0,400}?\b((?:https?:\/\/|www\.)[^\s"'<>]+)/gi;
  match = urlNearLabel.exec(html);
  while (match) {
    candidates.push(match[1]);
    match = urlNearLabel.exec(html);
  }

  const rowValue = /<(?:td|th|dt|span|strong|b)[^>]*>\s*web[\s-]*site\s*<\/(?:td|th|dt|span|strong|b)>\s*<(?:td|dd|span|div)[^>]*>([\s\S]{0,240})<\/(?:td|dd|span|div)>/gi;
  match = rowValue.exec(html);
  while (match) {
    candidates.push(stripTags(match[1]));
    match = rowValue.exec(html);
  }

  return Array.from(
    new Set(
      candidates
        .map((candidate) => decodeEntities(stripTags(candidate ?? "")).trim())
        .filter(Boolean)
    )
  );
}

function normalizeDomain(rawValue) {
  if (typeof rawValue !== "string") return null;

  let value = decodeEntities(rawValue).trim().toLowerCase();
  if (!value) return null;

  value = value.replace(/^website\s*[:\-]\s*/i, "").trim();
  if (!value || value === "-" || value === "n/a") return null;
  if (value.startsWith("mailto:") || value.startsWith("javascript:")) return null;

  let hostname = "";
  try {
    let asUrl = value;
    if (asUrl.startsWith("//")) {
      asUrl = `https:${asUrl}`;
    } else if (!/^https?:\/\//.test(asUrl)) {
      asUrl = `https://${asUrl}`;
    }
    hostname = new URL(asUrl).hostname.toLowerCase();
  } catch {
    const fallback = value.match(/^([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i);
    hostname = fallback ? fallback[1].toLowerCase() : "";
  }

  if (!hostname) return null;
  hostname = hostname.replace(/^www\./, "");
  hostname = hostname.replace(/\.+$/, "");

  if (!hostname.includes(".")) return null;
  if (hostname === "localhost") return null;
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(hostname)) return null;

  const labels = hostname.split(".");
  const tld = labels[labels.length - 1];
  if (!tld || !/^[a-z]{2,}$/.test(tld)) return null;
  if (labels.some((label) => label.length === 0 || label.startsWith("-") || label.endsWith("-"))) return null;

  return hostname;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "psx-logo-domain-candidates-script/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

function buildTargets({ args, allTickers, existingTickers }) {
  let skippedExisting = 0;
  const scope = args.symbols ? args.symbols : allTickers;
  const available = scope.filter((ticker) => allTickers.includes(ticker));
  const unknownSymbols = scope.filter((ticker) => !allTickers.includes(ticker));

  const targets = [];
  for (const ticker of available) {
    if (!args.force && existingTickers.has(ticker)) {
      skippedExisting += 1;
      continue;
    }
    targets.push(ticker);
  }

  const slicedTargets = args.symbols || args.all ? targets : targets.slice(0, args.limit);
  return {
    targets: slicedTargets,
    skippedExisting,
    unknownSymbols,
  };
}

function printCopyPasteBlock(candidates) {
  console.log("const NEW_TICKER_DOMAINS = {");
  for (const entry of candidates) {
    console.log(`  ${entry.ticker}: "${entry.domain}",`);
  }
  console.log("};");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tickerMapSource = await readFile(TICKER_DOMAIN_MAP_FILE, "utf8");
  const allTickers = await fetchAllSymbols();

  const existingTickers = parseTickerKeysFromDomainMap(tickerMapSource);

  const { targets, skippedExisting, unknownSymbols } = buildTargets({
    args,
    allTickers,
    existingTickers,
  });

  if (unknownSymbols.length > 0) {
    console.warn(`[logo-domains] unknown symbols ignored: ${unknownSymbols.join(", ")}`);
  }

  const summary = {
    totalChecked: 0,
    found: 0,
    skippedExisting,
    missingWebsite: 0,
    failed: 0,
  };

  const candidates = [];

  for (const ticker of targets) {
    summary.totalChecked += 1;
    const source = `${SOURCE_BASE_URL}/${encodeURIComponent(ticker)}`;

    let html;
    try {
      html = await fetchHtml(source);
    } catch (error) {
      summary.failed += 1;
      console.warn(`[logo-domains] ${ticker} failed (${error instanceof Error ? error.message : "unknown error"})`);
      if (args.delayMs > 0) await sleep(args.delayMs);
      continue;
    }

    const websiteCandidates = extractWebsiteRawCandidates(html);
    const normalizedDomain = websiteCandidates
      .map((value) => normalizeDomain(value))
      .find(Boolean);

    if (!normalizedDomain) {
      summary.missingWebsite += 1;
      if (args.delayMs > 0) await sleep(args.delayMs);
      continue;
    }

    candidates.push({
      ticker,
      domain: normalizedDomain,
      source,
    });
    summary.found += 1;

    if (args.delayMs > 0) await sleep(args.delayMs);
  }

  const deduped = Array.from(
    new Map(candidates.map((entry) => [entry.ticker, entry])).values()
  ).sort((a, b) => a.ticker.localeCompare(b.ticker));

  await mkdir(path.dirname(OUTPUT_JSON_FILE), { recursive: true });
  await writeFile(OUTPUT_JSON_FILE, `${JSON.stringify(deduped, null, 2)}\n`, "utf8");

  printCopyPasteBlock(deduped);
  console.log("");
  console.log("[logo-domains] complete");
  console.log(`- total checked: ${summary.totalChecked}`);
  console.log(`- found: ${summary.found}`);
  console.log(`- skipped existing: ${summary.skippedExisting}`);
  console.log(`- missing website: ${summary.missingWebsite}`);
  console.log(`- failed: ${summary.failed}`);
  console.log(`- output: ${OUTPUT_JSON_FILE}`);
}

main().catch((error) => {
  console.error(`[logo-domains] fatal error: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
