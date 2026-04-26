#!/usr/bin/env node

import { chromium } from "playwright";

const SOURCE_URL = "https://beta.nccpl.com.pk/market-information";
const RENDER_WAIT_MS = 1800;
const TEST_DATES = [
  "2026-04-13",
  "2026-04-12",
  "2026-04-11",
  "2026-04-10",
  "2026-04-09",
  "2026-04-08",
  "2026-04-07",
  "2026-04-06",
  "2026-04-05",
  "2026-04-04",
];

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
  if (rows.length < 2) return null;
  const headers = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, " ").trim());
  const bodyRows = rows.slice(1).filter((r) => r.some((v) => v.trim().length > 0));
  return { headers, rows: bodyRows };
}

function extractTables(html) {
  return html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
}

function looksLikeFipiSectorWise(headers) {
  const hasSectorName = headers.some((h) => h.includes("sector name"));
  const hasBuy = headers.some((h) => h.includes("buy value") && h.includes("pkr"));
  const hasSell = headers.some((h) => h.includes("sell value") && h.includes("pkr"));
  return hasSectorName && hasBuy && hasSell;
}

function countFipiSectors(parsedTable) {
  const sectorIdx = parsedTable.headers.findIndex((h) => h.includes("sector name"));
  if (sectorIdx < 0) return 0;
  let count = 0;
  for (const row of parsedTable.rows) {
    const sector = (row[sectorIdx] ?? "").trim().toLowerCase();
    if (!sector || sector.includes("total")) continue;
    count += 1;
  }
  return count;
}

function parseNumber(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[, ]+/g, "").replace(/[()]/g, "-").replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractFipiNetValue(parsedTable) {
  const netIdx = parsedTable.headers.findIndex((h) => h.includes("net value") && h.includes("pkr"));
  if (netIdx < 0) return null;
  for (const row of parsedTable.rows) {
    const sector = (row[0] ?? "").trim().toLowerCase();
    if (!sector || !sector.includes("total")) continue;
    const parsed = parseNumber(row[netIdx] ?? "");
    if (parsed != null) return parsed;
  }
  return null;
}

function analyzeFipiSectorWise(html) {
  const tables = extractTables(html);
  for (const tableHtml of tables) {
    const parsed = parseHtmlTable(tableHtml);
    if (!parsed) continue;
    if (!looksLikeFipiSectorWise(parsed.headers)) continue;
    const sectorCount = countFipiSectors(parsed);
    const netValue = extractFipiNetValue(parsed);
    return { found: sectorCount > 0, sectorCount, netValue };
  }
  return { found: false, sectorCount: 0, netValue: null };
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
        await page.waitForTimeout(600);
        return;
      }
    } catch {
      // Try next activator.
    }
  }
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
    }));
    metadata.push({ item, meta });
  }

  const fromInput =
    metadata.find(({ meta }) =>
      [meta.id, meta.name, meta.placeholder, meta.aria].some((v) => v.includes("from"))
    )?.item ?? null;
  const toInput =
    metadata.find(({ meta }) =>
      [meta.id, meta.name, meta.placeholder, meta.aria].some((v) => v.includes("to"))
    )?.item ?? null;

  if (fromInput && toInput) return { fromInput, toInput };
  if (visible.length >= 2) return { fromInput: visible[0], toInput: visible[1] };
  return { fromInput: null, toInput: null };
}

async function setDateInput(locator, isoDate) {
  await locator.click({ timeout: 3000 });
  await locator.fill("");
  await locator.fill(isoDate);
  await locator.dispatchEvent("input");
  await locator.dispatchEvent("change");
}

async function triggerLoad(page, toInput) {
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
      // Continue with fallback triggers.
    }
  }

  try {
    await toInput.press("Enter", { timeout: 1500 });
  } catch {
    // Ignore Enter trigger errors.
  }

  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(RENDER_WAIT_MS);
}

async function probeDate(page, date) {
  await activateRangeSection(page);
  const { fromInput, toInput } = await findRangeDateInputs(page);
  if (!fromInput || !toInput) return { found: false, sectorCount: 0, netValue: null };

  await setDateInput(fromInput, date);
  await setDateInput(toInput, date);
  await triggerLoad(page, toInput);

  const html = await page.content();
  return analyzeFipiSectorWise(html);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  let foundCount = 0;
  try {
    await page.goto(SOURCE_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);

    for (const date of TEST_DATES) {
      let result;
      try {
        result = await probeDate(page, date);
      } catch {
        result = { found: false, sectorCount: 0, netValue: null };
      }

      if (result.found) {
        foundCount += 1;
        const netSegment =
          result.netValue != null ? ` | fipiNet=${result.netValue}` : " | fipiNet=n/a";
        console.log(`${date} -> FOUND | fipiSectors=${result.sectorCount}${netSegment}`);
      } else {
        console.log(`${date} -> NO DATA`);
      }
    }

    if (foundCount === TEST_DATES.length) {
      console.log("RESULT: Single-day range works (daily backfill possible)");
    } else if (foundCount > 0) {
      console.log("RESULT: Partial coverage (only trading days available)");
    } else {
      console.log("RESULT: Single-day range does NOT work");
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
