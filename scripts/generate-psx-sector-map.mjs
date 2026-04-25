#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_FILE = path.resolve(process.cwd(), "lib/psxSymbolMetadata.ts");
const FALLBACK_BASE = "http://localhost:8787";

function getBaseUrl() {
  const fromEnv = (process.env.NEXT_PUBLIC_MARKET_API_BASE ?? "").trim();
  return (fromEnv || FALLBACK_BASE).replace(/\/$/, "");
}

function buildOutputFileContent(map, updatedAtIso) {
  const lines = [];
  lines.push("export type PsxSymbolMetadata = {");
  lines.push("  symbol: string;");
  lines.push("  sector?: string;");
  lines.push("  updatedAt?: string;");
  lines.push("};");
  lines.push("");
  lines.push("export const PSX_SYMBOL_METADATA: Record<string, PsxSymbolMetadata> = {");

  for (const symbol of Object.keys(map).sort((a, b) => a.localeCompare(b))) {
    const sector = map[symbol];
    lines.push(`  ${symbol}: { symbol: ${JSON.stringify(symbol)}, sector: ${JSON.stringify(sector)} },`);
  }

  lines.push("};");
  lines.push("");
  lines.push(`export const PSX_METADATA_UPDATED_AT = ${JSON.stringify(updatedAtIso)};`);
  lines.push("");
  return `${lines.join("\n")}`;
}

async function main() {
  const endpoint = `${getBaseUrl()}/stats/sectors`;
  console.log(`[psx-sectors] fetching ${endpoint}`);

  let payload;
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      console.error(`[psx-sectors] fetch failed with status ${response.status}`);
      process.exitCode = 1;
      return;
    }
    payload = await response.json();
  } catch (error) {
    console.error(
      `[psx-sectors] fetch failed: ${error instanceof Error ? error.message : "unknown error"}`
    );
    process.exitCode = 1;
    return;
  }

  const sectorsData =
    payload &&
    typeof payload === "object" &&
    payload.data &&
    typeof payload.data === "object" &&
    !Array.isArray(payload.data)
      ? payload.data
      : null;

  if (!sectorsData) {
    console.error("[psx-sectors] invalid response shape: missing object data");
    process.exitCode = 1;
    return;
  }

  const symbolToSector = {};
  for (const [sectorName, details] of Object.entries(sectorsData)) {
    if (!details || typeof details !== "object") continue;
    const symbols = Array.isArray(details.symbols) ? details.symbols : [];
    for (const rawSymbol of symbols) {
      if (typeof rawSymbol !== "string") continue;
      const symbol = rawSymbol.trim().toUpperCase();
      if (!symbol) continue;
      if (!symbolToSector[symbol]) {
        symbolToSector[symbol] = sectorName;
      }
    }
  }

  const symbolCount = Object.keys(symbolToSector).length;
  if (symbolCount === 0) {
    console.error("[psx-sectors] no symbols found; aborting without file changes");
    process.exitCode = 1;
    return;
  }

  const updatedAtIso = new Date().toISOString();
  const content = buildOutputFileContent(symbolToSector, updatedAtIso);
  await writeFile(OUTPUT_FILE, content, "utf8");

  console.log(`[psx-sectors] wrote ${symbolCount} symbols`);
  console.log(`[psx-sectors] output ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(
    `[psx-sectors] fatal error: ${error instanceof Error ? error.message : "unknown error"}`
  );
  process.exitCode = 1;
});
