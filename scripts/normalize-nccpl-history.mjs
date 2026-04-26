import fs from "node:fs/promises";
import path from "node:path";

const SOURCE_NAME = "NCCPL";
const SOURCE_URL = "https://www.nccpl.com.pk/market-information";
const CURRENCY = "PKR";
const ALL_OTHER_SECTORS = "All other Sectors";

const inputFile = path.join(
  process.cwd(),
  "public",
  "data",
  "nccpl",
  "foreign-investor-activity.history.raw.json"
);
const outputFile = path.join(
  process.cwd(),
  "public",
  "data",
  "nccpl",
  "foreign-investor-activity.history.json"
);

function parseNumber(value) {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const cleaned = String(value).replace(/,/g, "").replace(/\s+/g, "").trim();
  if (!cleaned) return 0;

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNumberWithPresence(value) {
  if (value == null) return { value: 0, hasValue: false };
  if (typeof value === "number") {
    return { value: Number.isFinite(value) ? value : 0, hasValue: Number.isFinite(value) };
  }

  const raw = String(value).trim();
  if (!raw) return { value: 0, hasValue: false };

  const cleaned = raw.replace(/,/g, "").replace(/\s+/g, "");
  if (!cleaned) return { value: 0, hasValue: false };

  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return { value: 0, hasValue: false };
  return { value: parsed, hasValue: true };
}

function directionFromNet(net) {
  if (net > 0) return "inflow";
  if (net < 0) return "outflow";
  return "flat";
}

function isDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeSectorLabel(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

function classifySuspiciousSectorName(value) {
  const raw = typeof value === "string" ? value : "";
  const trimmed = raw.trim();
  if (!trimmed) return "empty-or-whitespace";
  if (!/[A-Za-z0-9]/.test(trimmed)) return "symbols-only-or-no-alnum";

  const normalized = normalizeSectorLabel(trimmed);
  const compact = normalized.replace(/\s+/g, "");
  if (!normalized) return "symbols-only-or-no-alnum";

  if (
    compact === "TOTAL" ||
    compact === "GRANDTOTAL" ||
    compact === "SUBTOTAL" ||
    compact === "SECTORTOTAL" ||
    compact === "MARKETTOTAL" ||
    compact === "ALLTOTAL" ||
    compact === "NETTOTAL"
  ) {
    return "summary-label";
  }

  if (
    trimmed === "---" ||
    trimmed === "—" ||
    trimmed === "_" ||
    normalized === "---" ||
    normalized === "—" ||
    normalized === "_"
  ) {
    return "separator-label";
  }

  return null;
}

function isValidSectorName(value) {
  return classifySuspiciousSectorName(value) === null;
}

function normalizeDateEntry(dateEntry, timestamp) {
  if (!isDateString(dateEntry?.date)) return null;
  if (!Array.isArray(dateEntry.data) || dateEntry.data.length === 0) return null;

  const sectorMap = new Map();

  for (const row of dateEntry.data) {
    const sectorRaw = typeof row?.SECTOR_NAME === "string" ? row.SECTOR_NAME : "";
    const sector = sectorRaw.trim();
    if (!isValidSectorName(sector)) {
      continue;
    }

    const buy = Math.abs(parseNumber(row?.BUY_VALUE));
    const sell = Math.abs(parseNumber(row?.SELL_VALUE));
    const parsedNet = parseNumberWithPresence(row?.NET_VALUE);
    const net = parsedNet.hasValue ? parsedNet.value : buy - sell;

    const existing = sectorMap.get(sector) ?? { buy: 0, sell: 0, net: 0 };
    existing.buy += buy;
    existing.sell += sell;
    existing.net += net;
    sectorMap.set(sector, existing);
  }

  if (sectorMap.size === 0) return null;

  const sectors = Array.from(sectorMap.entries())
    .map(([sector, totals]) => {
      const totalActivity = totals.buy + totals.sell;
      return {
        sector,
        buy: totals.buy,
        sell: totals.sell,
        net: totals.net,
        totalActivity,
        direction: directionFromNet(totals.net),
      };
    })
    .sort((a, b) => {
      const aIsOther = a.sector === ALL_OTHER_SECTORS;
      const bIsOther = b.sector === ALL_OTHER_SECTORS;
      if (aIsOther && !bIsOther) return 1;
      if (!aIsOther && bIsOther) return -1;
      return b.totalActivity - a.totalActivity;
    });

  const foreignBuy = sectors.reduce((sum, sector) => sum + sector.buy, 0);
  const foreignSell = sectors.reduce((sum, sector) => sum + sector.sell, 0);
  const foreignNet = foreignBuy - foreignSell;

  return {
    sessionDate: dateEntry.date,
    updatedAt: timestamp,
    sourceName: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    foreignBuy,
    foreignSell,
    foreignNet,
    currency: CURRENCY,
    sectors,
  };
}

async function main() {
  const rawContent = await fs.readFile(inputFile, "utf8");
  const rawEntries = JSON.parse(rawContent);
  if (!Array.isArray(rawEntries)) {
    throw new Error("Input file must contain an array of date entries.");
  }

  const latestRawEntry = rawEntries.length > 0 ? rawEntries[rawEntries.length - 1] : null;
  const latestRawWithData = [...rawEntries]
    .reverse()
    .find((entry) => isDateString(entry?.date) && Array.isArray(entry?.data) && entry.data.length > 0);
  const recentRawWithData = [...rawEntries]
    .filter((entry) => isDateString(entry?.date) && Array.isArray(entry?.data) && entry.data.length > 0)
    .slice(-10);

  console.log(`Latest raw date: ${latestRawEntry?.date ?? "N/A"}`);
  console.log("Latest raw first 10 rows (SECTOR_NAME, BUY_VALUE, SELL_VALUE, NET_VALUE):");
  if (latestRawWithData) {
    const sampleRows = latestRawWithData.data.slice(0, 10).map((row) => ({
      SECTOR_NAME: row?.SECTOR_NAME ?? "",
      BUY_VALUE: row?.BUY_VALUE ?? "",
      SELL_VALUE: row?.SELL_VALUE ?? "",
      NET_VALUE: row?.NET_VALUE ?? "",
    }));
    console.log(JSON.stringify(sampleRows, null, 2));
  } else {
    console.log("[]");
  }

  const suspiciousSamples = [];
  for (const entry of recentRawWithData) {
    for (const row of entry.data) {
      const reason = classifySuspiciousSectorName(row?.SECTOR_NAME);
      if (reason) {
        suspiciousSamples.push({
          date: entry.date,
          reason,
          SECTOR_NAME: typeof row?.SECTOR_NAME === "string" ? row.SECTOR_NAME : "",
          MARKET_TYPE: row?.MARKET_TYPE ?? "",
          BUY_VALUE: row?.BUY_VALUE ?? "",
          SELL_VALUE: row?.SELL_VALUE ?? "",
          NET_VALUE: row?.NET_VALUE ?? "",
        });
      }
    }
  }
  console.log("Suspicious SECTOR_NAME values from latest non-empty sessions:");
  console.log(JSON.stringify(suspiciousSamples.slice(0, 40), null, 2));
  console.log(`Suspicious rows found (latest non-empty sessions): ${suspiciousSamples.length}`);

  const now = new Date().toISOString();
  const sessions = [];
  const skippedEmptyDates = [];

  for (const entry of rawEntries) {
    const normalized = normalizeDateEntry(entry, now);
    if (!normalized) {
      if (isDateString(entry?.date)) {
        skippedEmptyDates.push(entry.date);
      } else {
        skippedEmptyDates.push("(invalid-date-entry)");
      }
      continue;
    }
    sessions.push(normalized);
  }

  sessions.sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));

  const output = {
    sourceName: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    updatedAt: now,
    currency: CURRENCY,
    sessions,
  };

  await fs.writeFile(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  if (skippedEmptyDates.length > 0) {
    console.warn("Skipped empty or invalid dates:");
    for (const skippedDate of skippedEmptyDates) {
      console.warn(`- ${skippedDate}`);
    }
  }

  const earliest = sessions.length > 0 ? sessions[0].sessionDate : "N/A";
  const latest = sessions.length > 0 ? sessions[sessions.length - 1].sessionDate : "N/A";
  const latestSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;

  console.log(`Raw entries read: ${rawEntries.length}`);
  console.log(`Normalized sessions written: ${sessions.length}`);
  console.log(`Skipped empty dates: ${skippedEmptyDates.length}`);
  console.log(`Earliest sessionDate: ${earliest}`);
  console.log(`Latest sessionDate: ${latest}`);
  if (latestSession) {
    console.log(`Corrected foreignBuy: ${latestSession.foreignBuy}`);
    console.log(`Corrected foreignSell: ${latestSession.foreignSell}`);
    console.log(`Corrected foreignNet: ${latestSession.foreignNet}`);
    const hasInvalidSectorNames = latestSession.sectors.some((sector) => !isValidSectorName(sector.sector));
    const hasDashSector = latestSession.sectors.some((sector) => {
      const normalized = normalizeSectorLabel(sector.sector);
      return sector.sector.trim() === "^---" || sector.sector.trim() === "---" || normalized === "---";
    });
    console.log(`No blank/symbol-only sector names: ${hasInvalidSectorNames ? "NO" : "YES"}`);
    console.log(`No '^---'/'---' sector names: ${hasDashSector ? "NO" : "YES"}`);
    console.log(`Latest sector count: ${latestSession.sectors.length}`);
    console.log("First 10 latest sectors (buy/sell/net):");
    const sectorPreview = latestSession.sectors.slice(0, 10).map((sector) => ({
      sector: sector.sector,
      buy: sector.buy,
      sell: sector.sell,
      net: sector.net,
    }));
    console.log(JSON.stringify(sectorPreview, null, 2));
  } else {
    console.log("Corrected foreignBuy: N/A");
    console.log("Corrected foreignSell: N/A");
    console.log("Corrected foreignNet: N/A");
    console.log("No blank/symbol-only sector names: N/A");
    console.log("No '^---'/'---' sector names: N/A");
    console.log("Latest sector count: 0");
    console.log("First 10 latest sectors (buy/sell/net): []");
  }
  console.log(`Output path: ${outputFile}`);
}

main().catch((error) => {
  console.error("Failed to normalize NCCPL history:", error);
  process.exitCode = 1;
});
