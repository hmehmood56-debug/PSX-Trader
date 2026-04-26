#!/usr/bin/env node

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const SOURCE_URL = "https://beta.nccpl.com.pk/market-information";
const CHANGE_WAIT_TIMEOUT_MS = 7000;
const CHANGE_POLL_MS = 250;
const RANGES = [
  { from: "2026-04-07", to: "2026-04-13" },
  { from: "2026-04-01", to: "2026-04-13" },
  { from: "2026-03-13", to: "2026-04-13" },
  { from: "2025-04-13", to: "2026-04-13" },
];

function computeSimpleHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
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
      // Try next.
    }
  }
}

async function findRangeDateInputs(page) {
  const fromKnown = page.locator("#fipiSectorFromDateFilter").first();
  const toKnown = page.locator("#fipiSectorToDateFilter").first();
  if ((await fromKnown.count()) > 0 && (await toKnown.count()) > 0) {
    return { fromInput: fromKnown, toInput: toKnown };
  }

  const candidates = page.locator(
    [
      'input[type="date"]',
      'input[name*="date" i]',
      'input[id*="date" i]',
      'input[placeholder*="date" i]',
      'input[aria-label*="date" i]',
    ].join(",")
  );
  const count = await candidates.count();
  const visible = [];
  for (let i = 0; i < count; i += 1) {
    const item = candidates.nth(i);
    if (await item.isVisible().catch(() => false)) visible.push(item);
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

async function setInputValue(locator, isoDate) {
  await locator.click({ timeout: 3000 });
  await locator.fill("");
  await locator.fill(isoDate);
  await locator.dispatchEvent("input");
  await locator.dispatchEvent("change");
}

async function triggerLoad(page, toInput) {
  const formButton = toInput
    .locator("xpath=ancestor::form[1]")
    .locator("button, input[type='submit'], button[type='submit']")
    .first();

  if ((await formButton.count()) > 0) {
    await formButton.click({ timeout: 3000 }).catch(() => {});
  }

  const actions = [
    page.getByRole("button", { name: /search|apply|submit|show|go|filter|load|view|get|export/i }).first(),
    page.getByRole("link", { name: /search|apply|submit|show|go|filter|load|view|get|export/i }).first(),
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
      // Continue fallbacks.
    }
  }

  await toInput.press("Enter", { timeout: 1500 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

async function locateFipiSectorTable(page) {
  const sectionTable = page
    .locator(
      [
        "section",
        "article",
        "div.card",
        "div.panel",
        "div.tab-pane",
        "div[class*='tab']",
        "div[class*='sector']",
      ].join(",")
    )
    .filter({ hasText: /fipi sector wise/i })
    .locator("table")
    .filter({ hasText: /sec code/i })
    .filter({ hasText: /sector name/i })
    .first();

  if ((await sectionTable.count()) > 0) return sectionTable;

  const table = page
    .locator("table")
    .filter({ hasText: /fipi sector wise|sec code/i })
    .filter({ hasText: /sector name/i })
    .filter({ hasText: /buy value/i })
    .filter({ hasText: /sell value/i })
    .first();
  return table;
}

async function readTableSnapshot(page) {
  const table = await locateFipiSectorTable(page);
  if ((await table.count()) === 0) {
    return { tableText: "", sectors: 0, exists: false };
  }

  const evaluated = await table.evaluate((tbl) => {
    const norm = (v) => (v ?? "").replace(/\s+/g, " ").trim();
    const allRows = Array.from(tbl.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.querySelectorAll("th,td")).map((cell) => norm(cell.textContent))
    );

    const tableText = norm(tbl.textContent || "");
    const header = allRows.find((row) => row.some((cell) => /sector name/i.test(cell))) ?? [];
    const sectorIdx = header.findIndex((cell) => /sector name/i.test(cell));
    const headerRowIdx = header.length > 0 ? allRows.indexOf(header) : 0;
    const bodyRows = allRows.slice(headerRowIdx + 1);

    let sectors = 0;
    if (sectorIdx >= 0) {
      for (const row of bodyRows) {
        const sectorName = norm(row[sectorIdx]);
        if (!sectorName) continue;
        if (/total/i.test(sectorName)) continue;
        sectors += 1;
      }
    }

    return { tableText, sectors };
  });

  return { ...evaluated, exists: true };
}

async function waitForTableChange(page, previousTableText) {
  const start = Date.now();
  let latest = await readTableSnapshot(page);

  while (Date.now() - start < CHANGE_WAIT_TIMEOUT_MS) {
    latest = await readTableSnapshot(page);
    if (latest.exists && latest.tableText && latest.tableText !== previousTableText) {
      return { ...latest, changed: true };
    }
    await page.waitForTimeout(CHANGE_POLL_MS);
  }

  return { ...latest, changed: latest.tableText !== previousTableText };
}

async function runRange(page, fromDate, toDate, previousTableText, rangeIndex) {
  if (fromDate === toDate) {
    throw new Error("Invalid test: FROM and TO must differ for range probe.");
  }

  await activateRangeSection(page);
  const { fromInput, toInput } = await findRangeDateInputs(page);
  if (!fromInput || !toInput) {
    return { hasData: false, fipiSectors: 0, foreignNet: null, signature: null };
  }

  await setInputValue(fromInput, fromDate);
  await setInputValue(toInput, toDate);
  await triggerLoad(page, toInput);

  const after = await waitForTableChange(page, previousTableText);
  await page.screenshot({ path: `screenshots/nccpl-range-${rangeIndex}.png`, fullPage: true });

  const signatureSlice = (after.tableText || "").slice(0, 200);
  const hash = computeSimpleHash(after.tableText || "");
  return {
    sectors: after.sectors ?? 0,
    tableText: after.tableText || "",
    changedFromPrevious: Boolean(after.changed),
    signature: `${hash}:${signatureSlice}`,
    signatureSlice,
  };
}

async function main() {
  const context = await chromium.launchPersistentContext(".playwright/nccpl-profile", {
    headless: false,
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const results = [];
  try {
    page.on("response", (response) => {
      if (response.status() === 403) {
        console.log("403 BLOCKED – likely header/session issue");
      }
    });

    mkdirSync("screenshots", { recursive: true });
    await page.goto(SOURCE_URL, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2000);
    console.log(
      "IMPORTANT: If NCCPL shows a verification/blank state, interact manually in the opened browser once. After that, the session will persist."
    );
    await page.pause();
    await activateRangeSection(page);

    const baseline = await readTableSnapshot(page);
    let previousTableText = baseline.tableText || "";

    for (let index = 0; index < RANGES.length; index += 1) {
      const range = RANGES[index];
      let result = null;
      try {
        result = await runRange(page, range.from, range.to, previousTableText, index + 1);
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown";
        result = {
          sectors: 0,
          tableText: previousTableText,
          changedFromPrevious: false,
          signature: `error:${message}`,
          signatureSlice: "",
        };
      }

      results.push({ range, ...result });
      previousTableText = result.tableText;

      console.log(`RANGE ${range.from} -> ${range.to}`);
      console.log(`- sectors: ${result.sectors}`);
      console.log(`- signature: ${result.signatureSlice}`);
      console.log(`- changedFromPrevious: ${result.changedFromPrevious}`);
    }

    const allSignatures = results.map((item) => item.signature).filter(Boolean);
    const uniqueCount = new Set(allSignatures).size;
    if (uniqueCount > 1) {
      console.log("RESULT: RANGE DATA IS CHANGING (WORKS)");
    } else {
      console.log("RESULT: SCRIPT STILL READING STALE DATA");
    }
  } finally {
    await page.close();
    await context.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`[probe][error] ${message}`);
  process.exitCode = 1;
});
