#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const SOURCE_NAME = "NCCPL";
const SOURCE_URL = "https://beta.nccpl.com.pk/market-information";
const MAX_FETCH_ATTEMPTS = 2;
const PRIMARY_SECTIONS = {
  fipiNormal: "FIPI Normal",
  fipiSectorWise: "FIPI Sector Wise",
};
const OUTPUT_PATH = path.join(
  process.cwd(),
  "public/data/nccpl/foreign-investor-activity.latest.json"
);

function log(message) {
  console.log(`[nccpl-foreign] ${message}`);
}

function warn(message) {
  console.warn(`[nccpl-foreign][warn] ${message}`);
}

function fail(message) {
  console.error(`[nccpl-foreign][error] ${message}`);
}

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[, ]+/g, "")
    .replace(/[()]/g, "")
    .replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString().slice(0, 10);

  const dmY = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmY) {
    const [, dd, mm, yyyy] = dmY;
    const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return iso;
  }
  return null;
}

function toDirection(net) {
  if (net > 0) return "inflow";
  if (net < 0) return "outflow";
  return "flat";
}

function stripHtml(input) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function buildNormalizedPayload({ sessionDate, foreignBuy, foreignSell, sectors }) {
  const foreignNet = foreignBuy - foreignSell;
  return {
    sessionDate,
    updatedAt: new Date().toISOString(),
    sourceName: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    foreignBuy,
    foreignSell,
    foreignNet,
    currency: "PKR",
    sectors,
  };
}

function findSectionTableHtml(html, sectionLabel) {
  const lowered = html.toLowerCase();
  const labelIndex = lowered.indexOf(sectionLabel.toLowerCase());
  if (labelIndex < 0) return null;
  const tableStart = lowered.indexOf("<table", labelIndex);
  if (tableStart < 0) return null;
  const tableEnd = lowered.indexOf("</table>", tableStart);
  if (tableEnd < 0) return null;
  return html.slice(tableStart, tableEnd + "</table>".length);
}

function parseHtmlTable(tableHtml) {
  const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  if (rowMatches.length < 2) return null;
  const rows = rowMatches.map((rowHtml) => {
    const cellMatches = rowHtml.match(/<(td|th)[\s\S]*?<\/\1>/gi) ?? [];
    return cellMatches.map((cell) => stripHtml(cell));
  });
  if (rows.length < 2 || rows[0].length < 2) return null;
  const headers = rows[0].map((header) => header.toLowerCase().replace(/\s+/g, " ").trim());
  const bodyRows = rows.slice(1).filter((row) => row.some((value) => value.trim().length > 0));
  return { headers, rows: bodyRows };
}

function findColumnIndex(headers, matchers) {
  return headers.findIndex((header) => matchers.some((matcher) => matcher(header)));
}

function getSessionDateFromHtml(html) {
  const dateMatches = html.match(
    /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi
  );
  const parsedDates = (dateMatches ?? []).map((value) => normalizeDate(value)).filter(Boolean).sort();
  return parsedDates[parsedDates.length - 1] ?? null;
}

function parseFipiNormalTable(parsedTable) {
  const buyIdx = findColumnIndex(parsedTable.headers, [
    (h) => h.includes("buy value") && h.includes("pkr"),
    (h) => h === "buy value pkr",
  ]);
  const sellIdx = findColumnIndex(parsedTable.headers, [
    (h) => h.includes("sell value") && h.includes("pkr"),
    (h) => h === "sell value pkr",
  ]);
  if (buyIdx < 0 || sellIdx < 0) return null;

  let foreignBuy = 0;
  let foreignSell = 0;
  let matchedRows = 0;
  for (const row of parsedTable.rows) {
    const buy = parseNumber(row[buyIdx] ?? "");
    const sell = parseNumber(row[sellIdx] ?? "");
    if (buy == null || sell == null) continue;
    foreignBuy += buy;
    foreignSell += sell;
    matchedRows += 1;
  }
  if (matchedRows === 0) return null;
  return { foreignBuy, foreignSell };
}

function parseFipiSectorWiseTable(parsedTable) {
  const sectorIdx = findColumnIndex(parsedTable.headers, [
    (h) => h.includes("sector"),
    (h) => h.includes("client type"),
    (h) => h.includes("investor type"),
  ]);
  const buyIdx = findColumnIndex(parsedTable.headers, [
    (h) => h.includes("buy value") && h.includes("pkr"),
    (h) => h === "buy value pkr",
  ]);
  const sellIdx = findColumnIndex(parsedTable.headers, [
    (h) => h.includes("sell value") && h.includes("pkr"),
    (h) => h === "sell value pkr",
  ]);
  if (sectorIdx < 0 || buyIdx < 0 || sellIdx < 0) return null;

  const aggregates = new Map();
  for (const row of parsedTable.rows) {
    const rawSector = (row[sectorIdx] ?? "").trim();
    if (!rawSector || /total/i.test(rawSector)) continue;
    const buy = parseNumber(row[buyIdx] ?? "");
    const sell = parseNumber(row[sellIdx] ?? "");
    if (buy == null || sell == null) continue;
    const existing = aggregates.get(rawSector) ?? { buy: 0, sell: 0 };
    existing.buy += buy;
    existing.sell += sell;
    aggregates.set(rawSector, existing);
  }

  if (aggregates.size === 0) return null;

  const sectors = Array.from(aggregates.entries()).map(([sector, totals]) => {
    const net = totals.buy - totals.sell;
    return {
      sector,
      buy: totals.buy,
      sell: totals.sell,
      net,
      totalActivity: totals.buy + totals.sell,
      direction: toDirection(net),
    };
  });

  return sectors.sort((a, b) => b.totalActivity - a.totalActivity);
}

function parseFromKnownSections(html, options = { debug: false }) {
  const detectedHeadings = Object.values(PRIMARY_SECTIONS).filter((label) =>
    html.toLowerCase().includes(label.toLowerCase())
  );
  const fipiNormalTableHtml = findSectionTableHtml(html, PRIMARY_SECTIONS.fipiNormal);
  const fipiSectorTableHtml = findSectionTableHtml(html, PRIMARY_SECTIONS.fipiSectorWise);

  if (options.debug) {
    log(`Detected headings: ${detectedHeadings.length > 0 ? detectedHeadings.join(", ") : "none"}`);
    log(`Associated tables found: FIPI Normal=${fipiNormalTableHtml ? 1 : 0}, FIPI Sector Wise=${fipiSectorTableHtml ? 1 : 0}`);
  }

  if (!fipiNormalTableHtml || !fipiSectorTableHtml) {
    return { normalized: null, reason: "Required FIPI sections/tables were not found in HTML." };
  }

  const parsedNormalTable = parseHtmlTable(fipiNormalTableHtml);
  const parsedSectorTable = parseHtmlTable(fipiSectorTableHtml);
  if (!parsedNormalTable || !parsedSectorTable) {
    return { normalized: null, reason: "Unable to parse required table structures for FIPI sections." };
  }

  const normalTotals = parseFipiNormalTable(parsedNormalTable);
  const sectors = parseFipiSectorWiseTable(parsedSectorTable);
  if (!normalTotals || !sectors || sectors.length === 0) {
    return { normalized: null, reason: "Could not parse PKR buy/sell values from FIPI Normal or FIPI Sector Wise tables." };
  }

  if (options.debug) {
    log(`FIPI Normal sample row: ${JSON.stringify(parsedNormalTable.rows[0] ?? [])}`);
    log(`FIPI Sector Wise sample row: ${JSON.stringify(parsedSectorTable.rows[0] ?? [])}`);
    log(`Parsed sector rows: ${sectors.length}`);
  }

  const sessionDate = getSessionDateFromHtml(html);
  if (!sessionDate) {
    return { normalized: null, reason: "No parseable session date found in beta market-information HTML." };
  }

  const normalized = buildNormalizedPayload({
    sessionDate,
    foreignBuy: normalTotals.foreignBuy,
    foreignSell: normalTotals.foreignSell,
    sectors,
  });
  return { normalized, reason: null };
}

async function fetchSourceHtmlWithPlaywright() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      accept: "text/html",
      "accept-language": "en-US,en;q=0.9",
    },
  });

  try {
    const response = await page.goto(SOURCE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForLoadState("networkidle", { timeout: 20000 });
    await Promise.race([
      page.waitForSelector("text=FIPI", { timeout: 20000 }),
      page.waitForSelector("text=Sector", { timeout: 20000 }),
    ]);
    const body = await page.content();
    return {
      status: response?.status() ?? 0,
      finalUrl: page.url(),
      body,
    };
  } finally {
    await page.close();
    await browser.close();
  }
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
    debug: argv.includes("--debug"),
  };
}

function firstCharacters(text, size) {
  return text.slice(0, size).replace(/\s+/g, " ").trim();
}

function collectLikelyCandidates(html) {
  const keywords = [
    "Foreign Investor Activity",
    "FIPI",
    "LIPI",
    "Buy Volume",
    "Sell Volume",
    "Net",
    "Sector Wise",
  ];
  const lowered = html.toLowerCase();
  const candidates = [];

  for (const keyword of keywords) {
    const index = lowered.indexOf(keyword.toLowerCase());
    if (index < 0) continue;
    const start = Math.max(0, index - 180);
    const end = Math.min(html.length, index + 260);
    const snippet = stripHtml(html.slice(start, end));
    candidates.push({ keyword, snippet });
  }

  const tableCandidates = (html.match(/<table[\s\S]*?<\/table>/gi) ?? [])
    .slice(0, 4)
    .map((table) => stripHtml(table).slice(0, 280));

  return { keywordCandidates: candidates, tableCandidates };
}

function logDebugSnapshot(fetchResult, html) {
  log(`HTTP status: ${fetchResult.status}`);
  log(`Final URL: ${fetchResult.finalUrl}`);
  log(`HTML length: ${html.length}`);
  log(`HTML first 500 chars: ${firstCharacters(html, 500)}`);
  const candidates = collectLikelyCandidates(html);
  if (candidates.keywordCandidates.length === 0) {
    warn("No keyword candidates found for expected foreign activity labels.");
  } else {
    for (const candidate of candidates.keywordCandidates) {
      log(`Keyword match [${candidate.keyword}]: ${candidate.snippet}`);
    }
  }
  if (candidates.tableCandidates.length === 0) {
    warn("No <table> blocks found in returned HTML.");
  } else {
    for (const [index, text] of candidates.tableCandidates.entries()) {
      log(`Table candidate ${index + 1}: ${text}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  log(`Fetching source: ${SOURCE_URL}`);

  let fetchResult = null;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      fetchResult = await fetchSourceHtmlWithPlaywright();
      break;
    } catch (error) {
      lastError = error;
      warn(`Fetch attempt ${attempt} failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  if (!fetchResult) {
    fail(`Failed to fetch NCCPL source after ${MAX_FETCH_ATTEMPTS} attempts: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
    process.exitCode = 1;
    return;
  }

  const html = fetchResult.body;
  const blockedByCloudflare =
    fetchResult.status >= 400 ||
    /attention required/i.test(html) ||
    /cf-browser-verification/i.test(html) ||
    /cf-challenge/i.test(html);
  if (args.debug) {
    logDebugSnapshot(fetchResult, html);
  }

  if (!Number.isFinite(fetchResult.status) || fetchResult.status >= 400) {
    fail(`NCCPL source returned HTTP ${fetchResult.status}.`);
    if (blockedByCloudflare) {
      fail("Access appears blocked by Cloudflare challenge.");
    }
    process.exitCode = 1;
    return;
  }

  if (blockedByCloudflare) {
    fail("NCCPL beta page appears protected by Cloudflare challenge; unable to parse HTML tables safely.");
    process.exitCode = 1;
    return;
  }

  let normalized = null;
  const parseResult = parseFromKnownSections(html, { debug: args.debug });
  normalized = parseResult.normalized;

  if (!normalized) {
    fail(parseResult.reason ?? "Could not parse latest foreign investor activity from source. No output written.");
    fail("Could not parse latest foreign investor activity from source. No output written.");
    process.exitCode = 1;
    return;
  }

  const outputDir = path.dirname(OUTPUT_PATH);
  await mkdir(outputDir, { recursive: true });

  const payload = `${JSON.stringify(normalized, null, 2)}\n`;
  if (args.dryRun) {
    log("Dry run enabled; parsed payload preview:");
    console.log(payload);
    return;
  }

  await writeFile(OUTPUT_PATH, payload, "utf8");
  log(`Wrote normalized dataset to ${OUTPUT_PATH}`);
  log(`Session date: ${normalized.sessionDate}`);
  log(`Sectors parsed: ${normalized.sectors.length}`);
}

main().catch((error) => {
  fail(`Fatal error: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
