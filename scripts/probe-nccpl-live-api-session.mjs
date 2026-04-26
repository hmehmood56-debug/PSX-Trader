#!/usr/bin/env node

import { chromium } from "playwright";

const LIVE_PAGE_URL = "https://www.nccpl.com.pk/market-information";
const API_URL = "https://www.nccpl.com.pk/api/fipi-sector-wise/data";
const COOKIE_ORIGIN = "https://www.nccpl.com.pk";

const TEST_RANGES = [
  { name: "SAME_DAY", fromDate: "2026-04-13", toDate: "2026-04-13" },
  { name: "SEVEN_DAY", fromDate: "2026-04-07", toDate: "2026-04-13" },
  { name: "ONE_YEAR", fromDate: "2025-04-13", toDate: "2026-04-13" },
];

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const VIEWPORT = { width: 1440, height: 900 };
const WARMUP_RANGE = { fromDate: "2026-04-13", toDate: "2026-04-13" };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const cleaned = value.replace(/[, ]+/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildCookieHeader(cookies) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

function getDecodedXsrfToken(cookies) {
  const tokenCookie = cookies.find((cookie) => cookie.name === "XSRF-TOKEN");
  if (!tokenCookie) return null;
  try {
    return decodeURIComponent(tokenCookie.value);
  } catch {
    return tokenCookie.value;
  }
}

function summarizeRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      rowCount: 0,
      firstRowKeys: [],
      firstRow: null,
      groupedSectorCount: 0,
      totalNet: 0,
      top5SectorsByAbsNet: [],
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
        BUY_VALUE: 0,
        SELL_VALUE: 0,
        NET_VALUE: 0,
      });
    }

    const current = grouped.get(sectorName);
    current.BUY_VALUE += buy;
    current.SELL_VALUE += sell;
    current.NET_VALUE += net;
  }

  const top5SectorsByAbsNet = [...grouped.values()]
    .sort((a, b) => Math.abs(b.NET_VALUE) - Math.abs(a.NET_VALUE))
    .slice(0, 5);

  return {
    rowCount: rows.length,
    firstRowKeys: Object.keys(rows[0] ?? {}),
    firstRow: rows[0] ?? null,
    groupedSectorCount: grouped.size,
    totalNet,
    top5SectorsByAbsNet,
  };
}

function buildReplayHeaders(capturedHeaders, cookieHeader, xsrfToken) {
  const base = {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    Origin: "https://www.nccpl.com.pk",
    Referer: LIVE_PAGE_URL,
    "X-Requested-With": "XMLHttpRequest",
    Cookie: cookieHeader,
  };

  if (!capturedHeaders) {
    if (xsrfToken) base["X-XSRF-TOKEN"] = xsrfToken;
    return base;
  }

  const replay = {};
  for (const [key, value] of Object.entries(capturedHeaders)) {
    const lowered = key.toLowerCase();
    if (
      lowered === "host" ||
      lowered === "content-length" ||
      lowered === "connection" ||
      lowered === "accept-encoding" ||
      lowered === "cookie"
    ) {
      continue;
    }
    replay[key] = value;
  }

  replay.Accept = base.Accept;
  replay["Content-Type"] = base["Content-Type"];
  replay.Origin = base.Origin;
  replay.Referer = base.Referer;
  replay["X-Requested-With"] = base["X-Requested-With"];
  replay.Cookie = base.Cookie;
  if (xsrfToken) replay["X-XSRF-TOKEN"] = xsrfToken;
  return replay;
}

async function waitForCookies(context, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const cookies = await context.cookies(COOKIE_ORIGIN);
    if (cookies.length > 0) return cookies;
    await sleep(1000);
  }
  return [];
}

async function openAndEstablishSession(headless, cookieTimeoutMs) {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: VIEWPORT,
  });
  const page = await context.newPage();

  await page.goto(LIVE_PAGE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);

  const cookies = await waitForCookies(context, cookieTimeoutMs);
  return { browser, context, page, cookies };
}

async function captureBrowserApiRequestHeaders(page) {
  console.log("[session] Capturing browser-native API headers via in-page warmup request.");
  const waitForReq = page.waitForRequest(
    (request) => request.url() === API_URL && request.method().toUpperCase() === "POST",
    { timeout: 20000 }
  );

  await page.evaluate(
    async ({ url, body }) => {
      try {
        await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify(body),
        });
      } catch {
        // Request capture is what matters, even if response is blocked.
      }
    },
    { url: API_URL, body: WARMUP_RANGE }
  );

  const req = await waitForReq;
  const headers = req.headers();
  const keys = Object.keys(headers).sort();
  console.log(`[session] Captured request headers: ${keys.join(", ") || "(none)"}`);
  return headers;
}

async function callApiRange(page, headers, range) {
  const body = { fromDate: range.fromDate, toDate: range.toDate };

  const response = await page.request.post(API_URL, {
    headers,
    data: body,
    failOnStatusCode: false,
  });

  const status = response.status();
  const contentType = response.headers()["content-type"] ?? "unknown";
  const text = await response.text();
  const parsed = parseJsonSafe(text);
  const isJson = parsed !== null;
  const rows = Array.isArray(parsed) ? parsed : [];
  const summary = summarizeRows(rows);

  return {
    range,
    body,
    status,
    contentType,
    isJson,
    summary,
    htmlPreview: isJson ? null : text.slice(0, 300),
    success:
      status === 200 &&
      /application\/json/i.test(contentType) &&
      summary.rowCount > 0 &&
      summary.groupedSectorCount > 0,
  };
}

function logRangeResult(result) {
  console.log(`\n=== RANGE: ${result.range.name} ===`);
  console.log(`request_body: ${JSON.stringify(result.body)}`);
  console.log(`http_status: ${result.status}`);
  console.log(`content_type: ${result.contentType}`);
  console.log(`json_parsed: ${result.isJson}`);
  console.log(`row_count: ${result.summary.rowCount}`);
  console.log(`first_row_keys: ${JSON.stringify(result.summary.firstRowKeys)}`);
  console.log(`first_row_sample: ${JSON.stringify(result.summary.firstRow)}`);
  console.log(`grouped_sector_count: ${result.summary.groupedSectorCount}`);
  console.log(`total_net: ${result.summary.totalNet}`);
  console.log(`top_5_sectors_by_abs_net: ${JSON.stringify(result.summary.top5SectorsByAbsNet)}`);

  if (result.status === 403) {
    console.log(
      "403 returned even with cookies/session. Session headers still insufficient or Cloudflare is blocking scripted API calls."
    );
  }

  if (!result.isJson && result.htmlPreview) {
    console.log(`html_preview_300: ${JSON.stringify(result.htmlPreview)}`);
  }
}

function logFinalResult(results) {
  const successCount = results.filter((result) => result.success).length;
  if (successCount === results.length) {
    console.log("RESULT: LIVE NCCPL API SESSION METHOD WORKS");
    return;
  }
  if (successCount > 0) {
    console.log("RESULT: LIVE NCCPL API PARTIALLY WORKS");
    return;
  }
  console.log("RESULT: LIVE NCCPL API STILL BLOCKED");
}

async function main() {
  let browser = null;
  let context = null;
  let page = null;

  try {
    console.log("[session] Attempt 1: headless mode");
    let setup = await openAndEstablishSession(true, 20000);
    browser = setup.browser;
    context = setup.context;
    page = setup.page;
    let cookies = setup.cookies;

    console.log(`[session] Headless cookies found: ${cookies.length}`);
    console.log(`[session] Cookie names: ${cookies.map((cookie) => cookie.name).join(", ") || "(none)"}`);

    if (cookies.length === 0) {
      console.log(
        "No cookies captured in headless mode; retrying non-headless for manual/session establishment."
      );

      await page.close();
      await context.close();
      await browser.close();

      setup = await openAndEstablishSession(false, 60000);
      browser = setup.browser;
      context = setup.context;
      page = setup.page;
      cookies = setup.cookies;

      console.log(
        "If a verification/challenge page appears, complete it manually. Script will wait up to 60 seconds for cookies."
      );
      console.log(`[session] Non-headless cookies found: ${cookies.length}`);
      console.log(`[session] Cookie names: ${cookies.map((cookie) => cookie.name).join(", ") || "(none)"}`);
    }

    if (cookies.length === 0) {
      console.log("[session] No cookies available after fallback. API calls will not be attempted.");
      console.log("RESULT: LIVE NCCPL API STILL BLOCKED");
      return;
    }

    const cookieHeader = buildCookieHeader(cookies);
    const xsrfToken = getDecodedXsrfToken(cookies);
    console.log(`[session] Cookie header length: ${cookieHeader.length}`);
    console.log(`[session] XSRF token present: ${xsrfToken ? "yes" : "no"}`);
    const capturedHeaders = await captureBrowserApiRequestHeaders(page).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[session] Unable to capture browser-native API headers: ${message}`);
      return null;
    });
    const replayHeaders = buildReplayHeaders(capturedHeaders, cookieHeader, xsrfToken);

    const results = [];
    for (const range of TEST_RANGES) {
      const result = await callApiRange(page, replayHeaders, range);
      results.push(result);
      logRangeResult(result);
    }

    logFinalResult(results);
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[session][error] ${message}`);
  process.exitCode = 1;
});
