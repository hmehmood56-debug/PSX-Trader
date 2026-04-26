#!/usr/bin/env node

import { chromium } from "playwright";

const SOURCE_URL = "https://www.nccpl.com.pk/market-information";
const API_URL = "https://www.nccpl.com.pk/api/fipi-sector-wise/data";

const TEST_RANGES = [
  { label: "same-day", fromDate: "2026-04-13", toDate: "2026-04-13" },
  { label: "two-day", fromDate: "2026-04-12", toDate: "2026-04-13" },
  { label: "seven-day", fromDate: "2026-04-07", toDate: "2026-04-13" },
  { label: "one-year", fromDate: "2025-04-13", toDate: "2026-04-13" },
];

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const cleaned = value.replace(/[, ]+/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function summarizeRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      rowCount: 0,
      firstRowKeys: [],
      firstRow: null,
      aggregateSectorCount: 0,
      totalNet: 0,
      top5ByAbsNet: [],
    };
  }

  const grouped = new Map();
  let totalNet = 0;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const sectorName = String(row.SECTOR_NAME ?? "UNKNOWN").trim() || "UNKNOWN";
    const buy = toNumber(row.BUY_VALUE);
    const sell = toNumber(row.SELL_VALUE);
    const net = toNumber(row.NET_VALUE);

    totalNet += net;

    if (!grouped.has(sectorName)) {
      grouped.set(sectorName, {
        sectorName,
        buy: 0,
        sell: 0,
        net: 0,
      });
    }

    const entry = grouped.get(sectorName);
    entry.buy += buy;
    entry.sell += sell;
    entry.net += net;
  }

  const top5ByAbsNet = [...grouped.values()]
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
    .slice(0, 5);

  return {
    rowCount: rows.length,
    firstRowKeys: Object.keys(rows[0] ?? {}),
    firstRow: rows[0] ?? null,
    aggregateSectorCount: grouped.size,
    totalNet,
    top5ByAbsNet,
  };
}

function formatCookieHeader(cookies) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

function getXsrfToken(cookies) {
  const xsrfCookie = cookies.find((cookie) => cookie.name === "XSRF-TOKEN");
  if (!xsrfCookie) return null;
  try {
    return decodeURIComponent(xsrfCookie.value);
  } catch {
    return xsrfCookie.value;
  }
}

async function probeRange(page, cookieHeader, xsrfToken, range) {
  const body = {
    fromDate: range.fromDate,
    toDate: range.toDate,
  };

  const headers = {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    Origin: "https://www.nccpl.com.pk",
    Referer: SOURCE_URL,
    "X-Requested-With": "XMLHttpRequest",
    Cookie: cookieHeader,
  };

  if (xsrfToken) {
    headers["X-XSRF-TOKEN"] = xsrfToken;
  }

  const response = await page.request.post(API_URL, {
    headers,
    data: body,
    failOnStatusCode: false,
  });

  const status = response.status();
  const contentType = response.headers()["content-type"] ?? "unknown";
  const text = await response.text();
  const parsed = safeJsonParse(text);
  const isJson = parsed !== null;
  const rows = Array.isArray(parsed) ? parsed : [];
  const summary = summarizeRows(rows);

  return {
    range,
    status,
    contentType,
    isJson,
    body,
    summary,
    rawPreview: text.slice(0, 300),
  };
}

function logRangeResult(result) {
  const { range, status, contentType, isJson, summary } = result;
  console.log(`\n=== RANGE: ${range.label} (${range.fromDate} -> ${range.toDate}) ===`);
  console.log(`http_status: ${status}`);
  console.log(`content_type: ${contentType}`);
  console.log(`is_json: ${isJson}`);
  console.log(`row_count: ${summary.rowCount}`);
  console.log(`first_row_keys: ${JSON.stringify(summary.firstRowKeys)}`);
  console.log(`first_row: ${JSON.stringify(summary.firstRow)}`);
  console.log(`aggregate_sector_count: ${summary.aggregateSectorCount}`);
  console.log(`total_net: ${summary.totalNet}`);
  console.log(`top_5_sectors_by_abs_net: ${JSON.stringify(summary.top5ByAbsNet)}`);
  if (!isJson) {
    console.log(`non_json_preview: ${JSON.stringify(result.rawPreview)}`);
  }
}

function logFinalComparison(results) {
  console.log("\n=== FINAL COMPARISON ===");

  for (const result of results) {
    console.log(
      `${result.range.label}: row_count=${result.summary.rowCount}, total_net=${result.summary.totalNet}, status=${result.status}`
    );
  }

  const blocked = results.some((result) => result.status === 403 || result.status === 401);
  if (blocked) {
    console.log("RESULT: API blocked; needs session/header adjustment");
    return;
  }

  const sameDay = results.find((r) => r.range.label === "same-day");
  const sevenDay = results.find((r) => r.range.label === "seven-day");
  const oneYear = results.find((r) => r.range.label === "one-year");

  if (!sameDay || !sevenDay || !oneYear) {
    console.log("RESULT: probe incomplete");
    return;
  }

  const signatures = results.map((r) => `${r.status}|${r.summary.rowCount}|${r.summary.totalNet}`);
  const allIdentical = new Set(signatures).size === 1;
  if (allIdentical) {
    console.log("RESULT: API returned stale/default data");
    return;
  }

  const keyRangesDiffer =
    sameDay.summary.rowCount !== sevenDay.summary.rowCount ||
    sevenDay.summary.rowCount !== oneYear.summary.rowCount ||
    sameDay.summary.totalNet !== sevenDay.summary.totalNet ||
    sevenDay.summary.totalNet !== oneYear.summary.totalNet;

  if (keyRangesDiffer) {
    console.log("RESULT: LIVE API RANGE MODE WORKS");
    return;
  }

  console.log("RESULT: inconclusive; partial differences observed");
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    console.log(`[probe] Opening source page: ${SOURCE_URL}`);
    await page.goto(SOURCE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const cookies = await context.cookies(SOURCE_URL);
    const cookieHeader = formatCookieHeader(cookies);
    const xsrfToken = getXsrfToken(cookies);

    console.log(`[probe] Cookies captured: ${cookies.length}`);
    console.log(`[probe] XSRF token present: ${xsrfToken ? "yes" : "no"}`);

    const results = [];
    for (const range of TEST_RANGES) {
      const result = await probeRange(page, cookieHeader, xsrfToken, range);
      results.push(result);
      logRangeResult(result);
    }

    logFinalComparison(results);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[probe][error] ${message}`);
  process.exitCode = 1;
});
