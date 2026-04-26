#!/usr/bin/env node

import { chromium } from "playwright";

const SOURCE_URL = "https://beta.nccpl.com.pk/market-information";
const RANGE_FROM = "2025-04-13";
const RANGE_TO = "2026-04-13";
const RENDER_WAIT_MS = 2200;

function stripHtml(input) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
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

function parseHtmlTable(tableHtml) {
  const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  if (rowMatches.length === 0) return null;
  const rows = rowMatches.map((rowHtml) => {
    const cellMatches = rowHtml.match(/<(td|th)[\s\S]*?<\/\1>/gi) ?? [];
    return cellMatches.map((cell) => stripHtml(cell));
  });
  if (rows.length === 0) return null;
  const headers = (rows[0] ?? []).map((h) => h.toLowerCase().replace(/\s+/g, " ").trim());
  const bodyRows = rows.slice(1).filter((r) => r.some((v) => v.trim().length > 0));
  return { headers, rows: bodyRows };
}

function extractTables(html) {
  return html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
}

function detectFipiLipiPresence(html) {
  const lowered = html.toLowerCase();
  return {
    hasFipiSectorWise: lowered.includes("fipi sector wise"),
    hasLipiSectorWise: lowered.includes("lipi sector wise"),
  };
}

function looksLikeSectorWise(headers) {
  const hasSectorName = headers.some((h) => h.includes("sector name"));
  const hasBuy = headers.some((h) => h.includes("buy") && h.includes("pkr"));
  const hasSell = headers.some((h) => h.includes("sell") && h.includes("pkr"));
  return hasSectorName && hasBuy && hasSell;
}

function collectDateStrings(text) {
  const matches = text.match(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/g) ?? [];
  return matches;
}

function normalizeDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dmy = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!dmy) return null;
  const [, dd, mm, yyyy] = dmy;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function analyzeRenderedContent(html) {
  const tables = extractTables(html);
  const parsedTables = tables.map((t) => parseHtmlTable(t)).filter(Boolean);

  const dateColumnTables = parsedTables.filter((table) =>
    table.headers.some((h) => /\b(date|settlement date|trade date)\b/.test(h))
  );

  const rowLevelDates = new Set();
  for (const table of dateColumnTables) {
    for (const row of table.rows) {
      for (const cell of row) {
        const cellDates = collectDateStrings(cell).map((d) => normalizeDate(d)).filter(Boolean);
        for (const d of cellDates) rowLevelDates.add(d);
      }
    }
  }

  const text = stripHtml(html);
  const distinctDates = Array.from(
    new Set(collectDateStrings(text).map((d) => normalizeDate(d)).filter(Boolean))
  ).sort();

  const sectorTables = parsedTables.filter((table) => looksLikeSectorWise(table.headers));
  const fipiSectorTable = sectorTables[0] ?? null;
  const fipiSectorCount = fipiSectorTable
    ? fipiSectorTable.rows.filter((row) => {
        const sectorName = (row[0] ?? "").trim().toUpperCase();
        if (!sectorName) return false;
        return !/total/.test(sectorName);
      }).length
    : 0;

  const { hasFipiSectorWise, hasLipiSectorWise } = detectFipiLipiPresence(html);

  const isDailyByColumns = rowLevelDates.size >= 2;
  const isDailyByDistinctDates = distinctDates.length >= 2;
  const isDaily = isDailyByColumns || isDailyByDistinctDates;

  const mode = isDaily ? "DAILY" : "AGGREGATED";
  return {
    mode,
    distinctDates,
    fipiSectorCount,
    hasFipiSectorWise,
    hasLipiSectorWise,
    totalTables: parsedTables.length,
    dateColumnTableCount: dateColumnTables.length,
  };
}

async function findRangeDateInputs(page) {
  const knownFrom = page.locator("#fipiSectorFromDateFilter").first();
  const knownTo = page.locator("#fipiSectorToDateFilter").first();
  if ((await knownFrom.count()) > 0 && (await knownTo.count()) > 0) {
    return { fromInput: knownFrom, toInput: knownTo };
  }

  const allCandidates = page.locator(
    [
      'input[type="date"]',
      'input[name*="date" i]',
      'input[id*="date" i]',
      'input[placeholder*="date" i]',
      'input[aria-label*="date" i]',
    ].join(",")
  );

  const count = await allCandidates.count();
  const visible = [];
  for (let i = 0; i < count; i += 1) {
    const item = allCandidates.nth(i);
    if (await item.isVisible().catch(() => false)) {
      visible.push(item);
    }
  }

  const metadata = [];
  for (const item of visible) {
    const meta = await item.evaluate((el) => ({
      id: (el.getAttribute("id") ?? "").toLowerCase(),
      name: (el.getAttribute("name") ?? "").toLowerCase(),
      placeholder: (el.getAttribute("placeholder") ?? "").toLowerCase(),
      aria: (el.getAttribute("aria-label") ?? "").toLowerCase(),
      type: (el.getAttribute("type") ?? "").toLowerCase(),
    }));
    metadata.push({ item, meta });
  }

  const fromCandidate =
    metadata.find(({ meta }) =>
      [meta.id, meta.name, meta.placeholder, meta.aria].some((v) => v.includes("from"))
    )?.item ?? null;
  const toCandidate =
    metadata.find(({ meta }) =>
      [meta.id, meta.name, meta.placeholder, meta.aria].some((v) => v.includes("to"))
    )?.item ?? null;

  if (fromCandidate && toCandidate) {
    return { fromInput: fromCandidate, toInput: toCandidate };
  }

  if (visible.length >= 2) {
    return { fromInput: visible[0], toInput: visible[1] };
  }

  return { fromInput: null, toInput: null };
}

async function activateRangeSection(page) {
  const activators = [
    page.getByRole("tab", { name: /fipi sector wise|sector wise/i }).first(),
    page.getByRole("button", { name: /fipi sector wise|sector wise/i }).first(),
    page.getByRole("link", { name: /fipi sector wise|sector wise/i }).first(),
    page.locator("text=FIPI Sector Wise").first(),
  ];

  for (const target of activators) {
    try {
      if ((await target.count()) > 0) {
        await target.click({ timeout: 3000 });
        await page.waitForTimeout(700);
        break;
      }
    } catch {
      // Ignore and continue trying other activators.
    }
  }
}

async function setInputValue(locator, isoDate) {
  await locator.click({ timeout: 3000 });
  await locator.fill("");
  await locator.fill(isoDate);
  await locator.dispatchEvent("input");
  await locator.dispatchEvent("change");
  return locator.inputValue();
}

async function triggerLoad(page, primaryInput) {
  const actions = [
    page.getByRole("button", { name: /search|apply|submit|show|go|filter|load|view|get/i }).first(),
    page.getByRole("link", { name: /search|apply|submit|show|go|filter|load|view|get/i }).first(),
    page.locator('button[type="submit"]').first(),
    page.locator('input[type="submit"]').first(),
  ];

  for (const action of actions) {
    try {
      if ((await action.count()) > 0) {
        await action.click({ timeout: 3000 });
        break;
      }
    } catch {
      // Continue with fallback trigger.
    }
  }

  try {
    await primaryInput.press("Enter", { timeout: 1500 });
  } catch {
    // Some controls do not react to Enter.
  }

  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(RENDER_WAIT_MS);
}

function contentSignature(html) {
  const tablesText = stripHtml(extractTables(html).join("\n"));
  return tablesText.slice(0, 6000);
}

async function runRangeQuery(page, fromDate, toDate) {
  await activateRangeSection(page);
  const inputs = await findRangeDateInputs(page);
  if (!inputs.fromInput || !inputs.toInput) {
    throw new Error("Could not locate both From and To date inputs.");
  }

  const beforeHtml = await page.content();
  const beforeSignature = contentSignature(beforeHtml);

  const fromInputValue = await setInputValue(inputs.fromInput, fromDate);
  const toInputValue = await setInputValue(inputs.toInput, toDate);

  await triggerLoad(page, inputs.toInput);

  const afterHtml = await page.content();
  const afterSignature = contentSignature(afterHtml);

  return {
    fromInputValue,
    toInputValue,
    contentChanged: beforeSignature !== afterSignature,
    html: afterHtml,
  };
}

async function runSingleDateCheck(page, date) {
  const inputs = await findRangeDateInputs(page);
  if (!inputs.toInput) return null;
  await setInputValue(inputs.toInput, date);
  await triggerLoad(page, inputs.toInput);
  const html = await page.content();
  return contentSignature(html);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  try {
    console.log(`[probe] Opening ${SOURCE_URL}`);
    await page.goto(SOURCE_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);

    console.log(`[probe] Running one range query: ${RANGE_FROM} -> ${RANGE_TO}`);
    const rangeResult = await runRangeQuery(page, RANGE_FROM, RANGE_TO);
    const analysis = analyzeRenderedContent(rangeResult.html);

    console.log(`Range ${RANGE_FROM} -> ${RANGE_TO}`);
    console.log(`Detected Mode: ${analysis.mode}`);
    console.log(
      `[probe] inputValues from=${rangeResult.fromInputValue} to=${rangeResult.toInputValue} contentChanged=${rangeResult.contentChanged}`
    );

    if (analysis.mode === "DAILY") {
      const sample = analysis.distinctDates.slice(0, 3).join(", ") || "none";
      console.log(`distinctDates=${analysis.distinctDates.length}`);
      console.log(`sampleDates=${sample}`);
    } else {
      console.log(`fipiSectors=${analysis.fipiSectorCount}`);
      console.log(
        `fipiSectorWise=${analysis.hasFipiSectorWise ? "yes" : "no"} lipiSectorWise=${analysis.hasLipiSectorWise ? "yes" : "no"}`
      );
    }

    const rangeSignature = contentSignature(rangeResult.html);
    const singleDateSignature = await runSingleDateCheck(page, RANGE_TO);
    if (singleDateSignature) {
      const identical = singleDateSignature === rangeSignature;
      console.log(`[probe] Single-date comparison for ${RANGE_TO}: identicalTables=${identical}`);
    }
  } finally {
    await page.close();
    await browser.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`[probe][error] ${message}`);
  process.exitCode = 1;
});
