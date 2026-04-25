#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_MARKET_API_BASE = "http://localhost:8787";
const COMPANY_API_BASE = "https://psxterminal.com/api/companies";
const DEFAULT_LIMIT = 20;
const DEFAULT_DELAY_MIN_MS = 300;
const DEFAULT_DELAY_MAX_MS = 500;
const OUTPUT_FILE = path.resolve(process.cwd(), "lib/psxCompanyMetadata.ts");

function parseArgs(argv) {
  const args = {
    all: false,
    symbols: null,
  };

  for (const raw of argv) {
    if (raw === "--all") {
      args.all = true;
      continue;
    }

    if (raw.startsWith("--symbols=")) {
      const symbols = raw
        .slice("--symbols=".length)
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      if (symbols.length > 0) {
        args.symbols = Array.from(new Set(symbols));
      }
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

function randomDelay() {
  const span = DEFAULT_DELAY_MAX_MS - DEFAULT_DELAY_MIN_MS;
  return DEFAULT_DELAY_MIN_MS + Math.floor(Math.random() * (span + 1));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function asObject(value) {
  return value && typeof value === "object" ? value : null;
}

function asString(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function pickFirstString(...values) {
  for (const value of values) {
    const candidate = asString(value);
    if (candidate) return candidate;
  }
  return undefined;
}

function extractCompanyPayload(raw) {
  const root = asObject(raw);
  if (!root) return null;
  return asObject(root.data) ?? root;
}

function buildLocation(company) {
  const address = pickFirstString(company.address, company.companyAddress, company.registeredAddress);
  const city = pickFirstString(company.city, company.headOfficeCity, company.head_office_city);
  const country = pickFirstString(company.country, company.countryName, company.country_name);
  const parts = [address, city, country].filter(Boolean);
  if (parts.length === 0) return undefined;
  return Array.from(new Set(parts)).join(", ");
}

function extractCompanyMetadata(symbol, payload) {
  const company = extractCompanyPayload(payload);
  if (!company) return null;
  const profile = asObject(company.profile) ?? asObject(company.companyProfile) ?? asObject(company.company_profile);
  const contact = asObject(company.contact) ?? asObject(company.contactInfo) ?? asObject(company.contact_info);
  const addressNode = asObject(company.address) ?? asObject(company.location);

  const metadata = {
    symbol,
  };

  const name = pickFirstString(
    company.name,
    company.companyName,
    company.company_name,
    company.fullName,
    company.full_name,
    profile?.name,
    profile?.companyName,
    company.shortName,
    company.short_name
  );
  if (name) metadata.name = name;

  const industry = pickFirstString(
    company.industry,
    company.industryName,
    company.industry_name,
    company.sector,
    profile?.industry,
    profile?.industryName,
    profile?.sector
  );
  if (industry) metadata.industry = industry;

  const description = pickFirstString(
    company.description,
    company.companyDescription,
    company.company_description,
    company.businessDescription,
    company.business_description,
    profile?.description,
    profile?.companyDescription,
    profile?.businessDescription,
    company.profile,
    company.about
  );
  if (description) metadata.description = description;

  const website = pickFirstString(
    company.website,
    company.web,
    company.url,
    company.companyWebsite,
    profile?.website,
    profile?.url,
    contact?.website
  );
  if (website) metadata.website = website;

  const location = buildLocation({
    ...company,
    ...(profile ?? {}),
    ...(contact ?? {}),
    ...(addressNode ?? {}),
  });
  if (location) metadata.location = location;

  const keyPeopleRaw = asArray(company.keyPeople);
  const keyPeople = keyPeopleRaw
    .map((person) => {
      if (!person || typeof person !== "object") return null;
      const name = pickFirstString(person.name, person.fullName, person.full_name);
      if (!name) return null;
      const position = pickFirstString(person.position, person.role, person.title);
      return position ? { name, position } : { name };
    })
    .filter(Boolean);
  if (keyPeople.length > 0) {
    metadata.keyPeople = keyPeople;
  }

  const managementRaw = asArray(company.management);
  const management = managementRaw
    .map((entry) => {
      if (typeof entry === "string") return asString(entry);
      if (!entry || typeof entry !== "object") return undefined;
      return pickFirstString(entry.name, entry.fullName, entry.title, entry.position);
    })
    .filter(Boolean);
  if (management.length > 0) {
    metadata.management = management;
  }

  const ceo = pickFirstString(company.ceo, profile?.ceo, company.chiefExecutiveOfficer);
  if (ceo) {
    metadata.ceo = ceo;
  } else if (keyPeople.length > 0) {
    const ceoFromPeople = keyPeople.find((person) => {
      const position = asString(person.position);
      return position ? position.toLowerCase().includes("ceo") : false;
    });
    if (ceoFromPeople?.name) {
      metadata.ceo = ceoFromPeople.name;
    }
  }

  return metadata;
}

function toTsObjectLiteral(value, indent = 0) {
  const pad = " ".repeat(indent);
  const nextPad = " ".repeat(indent + 2);
  const entries = Object.entries(value);
  if (entries.length === 0) return "{}";
  return `{\n${entries
    .map(([key, entryValue]) => {
      if (entryValue && typeof entryValue === "object" && !Array.isArray(entryValue)) {
        return `${nextPad}${key}: ${toTsObjectLiteral(entryValue, indent + 2)}`;
      }
      return `${nextPad}${key}: ${JSON.stringify(entryValue)}`;
    })
    .join(",\n")}\n${pad}}`;
}

function buildOutputFile(metadataMap, updatedAt) {
  return `export type PsxCompanyMetadata = {
  symbol: string;
  name?: string;
  industry?: string;
  description?: string;
  website?: string;
  location?: string;
  keyPeople?: Array<{
    name: string;
    position?: string;
  }>;
  management?: string[];
  ceo?: string;
};

export const PSX_COMPANY_METADATA: Record<string, PsxCompanyMetadata> = ${toTsObjectLiteral(metadataMap)};

export const PSX_COMPANY_METADATA_UPDATED_AT = ${JSON.stringify(updatedAt)};

export function getPsxCompanyMetadata(ticker: string) {
  return PSX_COMPANY_METADATA[ticker?.toUpperCase()];
}

export function getCompanyDescription(ticker: string) {
  return getPsxCompanyMetadata(ticker)?.description;
}
`;
}

function hasField(root, data, fieldName) {
  const rootObject = asObject(root) ?? {};
  const dataObject = asObject(data) ?? {};
  return fieldName in rootObject || fieldName in dataObject;
}

function logDiscoveryShape(symbol, payload) {
  const root = asObject(payload) ?? {};
  const data = asObject(root.data) ?? {};
  const topLevelKeys = Object.keys(root);
  const dataKeys = Object.keys(data);
  const existenceMap = {
    name: hasField(root, data, "name"),
    description: hasField(root, data, "description") || hasField(root, data, "businessDescription"),
    industry: hasField(root, data, "industry"),
    website: hasField(root, data, "website"),
    address: hasField(root, data, "address"),
    city: hasField(root, data, "city"),
    country: hasField(root, data, "country"),
    keyPeople: hasField(root, data, "keyPeople"),
    management: hasField(root, data, "management"),
    ceo: hasField(root, data, "ceo"),
    financialStats: hasField(root, data, "financialStats"),
  };

  console.log(`[psx-company][shape] ${symbol}`);
  console.log(`[psx-company][shape] topLevelKeys=${JSON.stringify(topLevelKeys)}`);
  console.log(`[psx-company][shape] dataKeys=${JSON.stringify(dataKeys)}`);
  console.log(`[psx-company][shape] fieldExists=${JSON.stringify(existenceMap)}`);
}

function extractSymbolsFromPayload(payload) {
  const root = asObject(payload);
  if (!root) return [];

  const candidates = Array.isArray(root.data) ? root.data : Array.isArray(payload) ? payload : [];
  const symbols = [];

  for (const item of candidates) {
    if (typeof item === "string") {
      const symbol = item.trim().toUpperCase();
      if (symbol) symbols.push(symbol);
      continue;
    }
    const row = asObject(item);
    if (!row) continue;
    const symbol = pickFirstString(row.symbol, row.ticker, row.code, row.name)?.toUpperCase();
    if (symbol) symbols.push(symbol);
  }

  return Array.from(new Set(symbols));
}

async function fetchWithOneRetry(url) {
  try {
    return await fetchJson(url);
  } catch (firstError) {
    await sleep(200);
    try {
      return await fetchJson(url);
    } catch {
      throw firstError;
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const marketApiBase = (process.env.NEXT_PUBLIC_MARKET_API_BASE || DEFAULT_MARKET_API_BASE).replace(/\/$/, "");
  const symbolsUrl = `${marketApiBase}/symbols`;

  let symbols = args.symbols;
  if (!symbols) {
    let symbolsPayload;
    try {
      symbolsPayload = await fetchWithOneRetry(symbolsUrl);
    } catch (error) {
      console.error(
        `[psx-company] failed to fetch symbols from ${symbolsUrl}: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
      process.exitCode = 1;
      return;
    }
    symbols = extractSymbolsFromPayload(symbolsPayload);
  }

  if (!symbols || symbols.length === 0) {
    console.error("[psx-company] no symbols found to process");
    process.exitCode = 1;
    return;
  }

  const selectedSymbols = args.symbols ? symbols : args.all ? symbols : symbols.slice(0, DEFAULT_LIMIT);
  const metadataEntries = {};
  const summary = {
    attempted: 0,
    parsed: 0,
    failed: 0,
  };

  for (const symbol of selectedSymbols) {
    summary.attempted += 1;
    const endpoint = `${COMPANY_API_BASE}/${encodeURIComponent(symbol)}`;

    let payload;
    try {
      payload = await fetchWithOneRetry(endpoint);
    } catch (error) {
      summary.failed += 1;
      console.warn(`[psx-company] ${symbol} fetch failed (${error instanceof Error ? error.message : "unknown error"})`);
      await sleep(randomDelay());
      continue;
    }

    logDiscoveryShape(symbol, payload);

    const metadata = extractCompanyMetadata(symbol, payload);
    if (!metadata) {
      summary.failed += 1;
      console.warn(`[psx-company] ${symbol} skipped (invalid response shape)`);
      await sleep(randomDelay());
      continue;
    }

    const hasStableField = Object.keys(metadata).some((key) => key !== "symbol");
    if (!hasStableField) {
      summary.failed += 1;
      console.warn(`[psx-company] ${symbol} skipped (no stable company fields found)`);
      await sleep(randomDelay());
      continue;
    }

    metadataEntries[symbol] = metadata;
    summary.parsed += 1;
    await sleep(randomDelay());
  }

  if (summary.parsed === 0) {
    console.error("[psx-company] zero valid companies parsed; output file left unchanged");
    process.exitCode = 1;
    return;
  }

  const sorted = Object.fromEntries(Object.entries(metadataEntries).sort(([a], [b]) => a.localeCompare(b)));
  const updatedAt = new Date().toISOString();
  const fileContent = buildOutputFile(sorted, updatedAt);
  await writeFile(OUTPUT_FILE, fileContent, "utf8");

  console.log("[psx-company] generation complete");
  console.log(`- attempted: ${summary.attempted}`);
  console.log(`- parsed: ${summary.parsed}`);
  console.log(`- failed: ${summary.failed}`);
  console.log(`- output: ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(`[psx-company] fatal error: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
