#!/usr/bin/env node

import { chromium } from "playwright";

const SOURCE_URL = "https://beta.nccpl.com.pk/market-information";
const MAX_DATES_PER_RUN = 10;
const MAX_ATTEMPTS_PER_DATE = 2; // 1 initial + 1 retry
const DATE_WAIT_MS = 1800;
const CONTENT_SIGNATURE_LIMIT = 5000;
const TEST_DATES = [
  "2026-04-13",
  "2026-04-01",
  "2026-03-15",
  "2025-12-15",
  "2025-06-15",
  "2024-12-15",
  "2023-12-15",
  "2022-12-15",
  "2020-12-15",
  "2016-12-15",
];

const REQUIRED_SECTIONS = {
  fipiNormal: "FIPI Normal",
  fipiSectorWise: "FIPI Sector Wise",
  lipiNormal: "LIPI Normal",
  lipiSectorWise: "LIPI Sector Wise",
};

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

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString().slice(0, 10);

  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return iso;
  }
  return null;
}

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

function findColumnIndex(headers, matcher) {
  return headers.findIndex((header) => matcher(header));
}

function isFipiSectorWiseTable(tableHtml) {
  const parsed = parseHtmlTable(tableHtml);
  if (!parsed) return false;
  const hasSecCode = parsed.headers.some((h) => h.includes("sec code"));
  const hasSectorName = parsed.headers.some((h) => h.includes("sector name"));
  const hasBuyValue = parsed.headers.some((h) => h.includes("buy value") && h.includes("pkr"));
  const hasSellValue = parsed.headers.some((h) => h.includes("sell value") && h.includes("pkr"));
  return hasSecCode && hasSectorName && hasBuyValue && hasSellValue;
}

function extractAllTableHtml(html) {
  return html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
}

function extractSessionDate(html) {
  const dateMatches = html.match(
    /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi
  );
  const parsedDates = (dateMatches ?? []).map((value) => normalizeDate(value)).filter(Boolean).sort();
  return parsedDates[parsedDates.length - 1] ?? null;
}

function detectSections(html) {
  const lowered = html.toLowerCase();
  const presence = Object.fromEntries(
    Object.entries(REQUIRED_SECTIONS).map(([key, label]) => [key, lowered.includes(label.toLowerCase())])
  );
  return presence;
}

function parseForeignNet(html) {
  const text = stripHtml(html);
  const netMatch =
    text.match(/foreign\s*net\s*[:\-]?\s*([()\-0-9,.\s]+)/i) ??
    text.match(/\bnet\s*[:\-]?\s*([()\-0-9,.\s]{3,})/i);
  if (!netMatch) return null;
  return parseNumber(netMatch[1]);
}

function parseFipiSectorCount(html) {
  const allTables = extractAllTableHtml(html);
  const sectorTableHtml = allTables.find((tableHtml) => isFipiSectorWiseTable(tableHtml)) ?? null;
  if (!sectorTableHtml) return null;
  const parsed = parseHtmlTable(sectorTableHtml);
  if (!parsed) return null;
  const sectorIdx = findColumnIndex(parsed.headers, (h) => h.includes("sector name"));
  if (sectorIdx < 0) return null;
  let count = 0;
  for (const row of parsed.rows) {
    const name = (row[sectorIdx] ?? "").trim().toUpperCase();
    if (!name || /total/.test(name)) continue;
    count += 1;
  }
  return count;
}

function buildDateVariants(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return [
    isoDate,
    `${day}-${month}-${year}`,
    `${day}/${month}/${year}`,
    `${month}/${day}/${year}`,
  ];
}

function buildContentSignature(html) {
  const tables = extractAllTableHtml(html).join("\n");
  const compact = stripHtml(tables || html);
  return compact.slice(0, CONTENT_SIGNATURE_LIMIT);
}

async function findDateInput(page) {
  const selectors = [
    'input[type="date"]',
    'input[name*="date" i]',
    'input[id*="date" i]',
    'input[placeholder*="date" i]',
    'input[aria-label*="date" i]',
  ];
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) return locator;
  }
  return null;
}

async function setDateValue(locator, value) {
  await locator.click({ timeout: 3000 });
  await locator.fill("");
  await locator.fill(value);
  await locator.dispatchEvent("input");
  await locator.dispatchEvent("change");
}

async function triggerLoad(page, dateInput) {
  const actionCandidates = [
    page.getByRole("button", { name: /search|apply|submit|show|go|filter|load|view|get/i }).first(),
    page.getByRole("link", { name: /search|apply|submit|show|go|filter|load|view|get/i }).first(),
    page.locator('button[type="submit"]').first(),
    page.locator('input[type="submit"]').first(),
  ];

  let actionTriggered = false;
  for (const action of actionCandidates) {
    try {
      if ((await action.count()) > 0) {
        await action.click({ timeout: 3000 });
        actionTriggered = true;
        break;
      }
    } catch {
      // Continue to next trigger path.
    }
  }

  try {
    await dateInput.press("Enter", { timeout: 1500 });
    actionTriggered = true;
  } catch {
    // Enter may not be supported for this control.
  }

  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(DATE_WAIT_MS);
  return actionTriggered;
}

async function applyDateAndRefresh(page, isoDate) {
  const dateInput = await findDateInput(page);
  if (!dateInput) {
    return {
      inputValue: "n/a",
      actionTriggered: false,
      changedDom: false,
      htmlAfter: await page.content(),
      error: "date input not found",
    };
  }

  const beforeHtml = await page.content();
  const beforeSignature = buildContentSignature(beforeHtml);
  const dateVariants = buildDateVariants(isoDate);

  let inputValue = "";
  let setWorked = false;
  for (const variant of dateVariants) {
    try {
      await setDateValue(dateInput, variant);
      inputValue = await dateInput.inputValue();
      setWorked = true;
      break;
    } catch {
      // Try next supported date format for the control.
    }
  }

  if (!setWorked) {
    return {
      inputValue: "n/a",
      actionTriggered: false,
      changedDom: false,
      htmlAfter: beforeHtml,
      error: "unable to set date value in input",
    };
  }

  const actionTriggered = await triggerLoad(page, dateInput);
  const htmlAfter = await page.content();
  const afterSignature = buildContentSignature(htmlAfter);
  const changedDom = beforeSignature !== afterSignature;

  return {
    inputValue,
    actionTriggered,
    changedDom,
    htmlAfter,
    error: null,
  };
}

function resultStatus(sections, fipiSectors, sessionDate) {
  const hasAnySection =
    sections.fipiNormal || sections.fipiSectorWise || sections.lipiNormal || sections.lipiSectorWise;
  if (!hasAnySection) return "NO VALID TABLES";
  if (fipiSectors === 0 || (fipiSectors == null && !sections.fipiSectorWise)) return "NO DATA";
  if (!sessionDate) return "FOUND";
  return "FOUND";
}

async function probeDate(page, requestedDate, baselineSessionDate) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_DATE; attempt += 1) {
    try {
      const beforeHtml = await page.content();
      const beforeSession = extractSessionDate(beforeHtml);
      const applyResult = await applyDateAndRefresh(page, requestedDate);
      const html = applyResult.htmlAfter;
      const sections = detectSections(html);
      const afterSession = extractSessionDate(html);
      const fipiSectors = parseFipiSectorCount(html);
      const hasAnySection =
        sections.fipiNormal || sections.fipiSectorWise || sections.lipiNormal || sections.lipiSectorWise;

      let status = "FOUND";
      if (!hasAnySection) {
        status = "NO DATA";
      } else if (!applyResult.actionTriggered && !applyResult.changedDom) {
        status = "NO CHANGE";
      } else if (!afterSession) {
        status = "NO DATA";
      } else if (requestedDate !== baselineSessionDate && afterSession === baselineSessionDate) {
        status = "NO CHANGE";
      }

      if (status !== "FOUND") {
        return {
          requestedDate,
          inputValue: applyResult.inputValue,
          beforeSession: beforeSession ?? "unknown",
          afterSession: afterSession ?? "unknown",
          status,
          fipiSectors: fipiSectors ?? "n/a",
          detail: applyResult.error ?? null,
        };
      }

      return {
        requestedDate,
        inputValue: applyResult.inputValue,
        beforeSession: beforeSession ?? "unknown",
        afterSession: afterSession ?? "unknown",
        status,
        fipiSectors: fipiSectors ?? "n/a",
      };
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_ATTEMPTS_PER_DATE) break;
      await page.waitForTimeout(1000);
    }
  }

  return {
    requestedDate,
    inputValue: "n/a",
    beforeSession: "unknown",
    afterSession: "unknown",
    status: "NO DATA",
    fipiSectors: "n/a",
    error: lastError instanceof Error ? lastError.message : "unknown error",
  };
}

function printResult(result) {
  console.log(
    `requested=${result.requestedDate} | inputValue=${result.inputValue} | beforeSession=${result.beforeSession} | afterSession=${result.afterSession} | status=${result.status} | fipiSectors=${result.fipiSectors}`
  );
  if (result.detail) {
    console.log(`  detail=${result.detail}`);
  }
  if (result.error) {
    console.log(`  error=${result.error}`);
  }
}

async function main() {
  const dates = TEST_DATES.slice(0, MAX_DATES_PER_RUN);
  if (dates.length > MAX_DATES_PER_RUN) {
    throw new Error(`Max ${MAX_DATES_PER_RUN} dates allowed per run.`);
  }
  if (new Set(dates).size !== dates.length) {
    throw new Error("Duplicate dates found in test set.");
  }

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
    const initialSession = extractSessionDate(await page.content());
    console.log(`[probe] Initial detected session date: ${initialSession ?? "unknown"}`);

    console.log(`[probe] Probing ${dates.length} historical dates (read-only)`);
    let anyHistoricalDateChanged = false;
    for (const date of dates) {
      const result = await probeDate(page, date, initialSession ?? "");
      printResult(result);
      if (
        result.status === "FOUND" &&
        initialSession &&
        date !== initialSession &&
        result.afterSession !== initialSession
      ) {
        anyHistoricalDateChanged = true;
      }
    }

    if (!anyHistoricalDateChanged && initialSession) {
      console.log("Historical date control not successfully triggered; probe inconclusive.");
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
