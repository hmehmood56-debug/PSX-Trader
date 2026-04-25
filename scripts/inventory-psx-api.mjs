#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_DELAY_MS = 200;
const DEFAULT_TICKERS = ["HBL", "PSO", "OGDC", "FFC", "HUBC"];
const WORKER_BASE = "https://soft-resonance-1d40.hmehmood56.workers.dev";
const TERMINAL_BASE = "https://psxterminal.com/api";
const OUTPUT_FILE = path.resolve(process.cwd(), "data/psx-api-inventory.json");
const REQUEST_TIMEOUT_MS = 15000;

const WORKER_ENDPOINTS = [
  { group: "worker", method: "GET", path: "/symbols" },
  { group: "worker", method: "GET", path: "/market" },
  { group: "worker", method: "GET", path: "/quote?ticker={ticker}", perTicker: true },
  { group: "worker", method: "GET", path: "/history?ticker={ticker}", perTicker: true },
  { group: "worker", method: "GET", path: "/chart?ticker={ticker}&range=1D", perTicker: true },
  { group: "worker", method: "GET", path: "/chart?ticker={ticker}&range=1W", perTicker: true },
  { group: "worker", method: "GET", path: "/chart?ticker={ticker}&range=1M", perTicker: true },
  { group: "worker", method: "GET", path: "/chart?ticker={ticker}&range=3M", perTicker: true },
  { group: "worker", method: "GET", path: "/chart?ticker={ticker}&range=1Y", perTicker: true },
  { group: "worker", method: "GET", path: "/chart?ticker={ticker}&range=ALL", perTicker: true },
  { group: "worker", method: "GET", path: "/fundamentals?ticker={ticker}", perTicker: true },
  { group: "worker", method: "GET", path: "/stats/REG" },
  { group: "worker", method: "GET", path: "/stats/breadth" },
  { group: "worker", method: "GET", path: "/stats/sectors" },
];

const TERMINAL_ENDPOINTS = [
  { group: "terminal", method: "GET", path: "/symbols" },
  { group: "terminal", method: "GET", path: "/market" },
  { group: "terminal", method: "GET", path: "/quote/{ticker}", perTicker: true },
  { group: "terminal", method: "GET", path: "/history/{ticker}", perTicker: true },
  { group: "terminal", method: "GET", path: "/chart/{ticker}", perTicker: true },
  { group: "terminal", method: "GET", path: "/fundamentals/{ticker}", perTicker: true },
  { group: "terminal", method: "GET", path: "/companies/{ticker}", perTicker: true },
  { group: "terminal", method: "GET", path: "/dividends/{ticker}", perTicker: true },
  { group: "terminal", method: "GET", path: "/announcements/{ticker}", perTicker: true },
  { group: "terminal", method: "GET", path: "/news/{ticker}", perTicker: true },
  { group: "terminal", method: "GET", path: "/yields/{ticker}", perTicker: true },
  { group: "terminal", method: "GET", path: "/technical/{ticker}", perTicker: true },
  { group: "terminal", method: "GET", path: "/ohlcv/{ticker}", perTicker: true },
];

function parseArgs(argv) {
  const args = {
    delayMs: DEFAULT_DELAY_MS,
    tickers: DEFAULT_TICKERS,
    workerOnly: false,
    terminalOnly: false,
  };

  for (const raw of argv) {
    if (raw.startsWith("--delay=")) {
      const value = Number(raw.slice("--delay=".length));
      if (Number.isFinite(value) && value >= 0) args.delayMs = Math.floor(value);
      continue;
    }
    if (raw.startsWith("--tickers=")) {
      const list = raw
        .slice("--tickers=".length)
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      if (list.length > 0) args.tickers = Array.from(new Set(list));
      continue;
    }
    if (raw === "--worker-only") {
      args.workerOnly = true;
      continue;
    }
    if (raw === "--terminal-only") {
      args.terminalOnly = true;
      continue;
    }
  }

  if (args.workerOnly && args.terminalOnly) {
    throw new Error("Use only one of --worker-only or --terminal-only");
  }

  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeContentType(contentType) {
  if (!contentType || typeof contentType !== "string") return null;
  return contentType.trim().toLowerCase();
}

function summarizeValue(value) {
  if (value === null) return { type: "null", value: null };
  if (value === undefined) return { type: "undefined", value: null };
  if (Array.isArray(value)) {
    return { type: "array", length: value.length };
  }
  const kind = typeof value;
  if (kind === "string") {
    return {
      type: "string",
      value: value.length > 120 ? `${value.slice(0, 117)}...` : value,
    };
  }
  if (kind === "number" || kind === "boolean") {
    return { type: kind, value };
  }
  if (kind === "object") {
    return { type: "object", keys: Object.keys(value).slice(0, 10) };
  }
  return { type: kind, value: String(value) };
}

function collectNestedKeys(value, maxDepth = 3) {
  const paths = new Set();

  function visit(node, depth, prefix) {
    if (depth > maxDepth || node === null || node === undefined) return;
    if (Array.isArray(node)) {
      const arrPath = prefix ? `${prefix}[]` : "[]";
      paths.add(arrPath);
      if (node.length > 0) visit(node[0], depth + 1, arrPath);
      return;
    }
    if (typeof node !== "object") return;

    const entries = Object.entries(node);
    for (const [key, val] of entries) {
      const next = prefix ? `${prefix}.${key}` : key;
      paths.add(next);
      if (depth < maxDepth) visit(val, depth + 1, next);
    }
  }

  visit(value, 1, "");
  return Array.from(paths).sort((a, b) => a.localeCompare(b));
}

function sampleTopLevelValues(jsonValue, maxKeys = 5) {
  if (!jsonValue || typeof jsonValue !== "object" || Array.isArray(jsonValue)) return {};
  const output = {};
  for (const key of Object.keys(jsonValue).slice(0, maxKeys)) {
    output[key] = summarizeValue(jsonValue[key]);
  }
  return output;
}

function arrayFirstItemShape(arr) {
  if (!Array.isArray(arr)) return null;
  if (arr.length === 0) return { empty: true };
  const first = arr[0];
  return {
    firstItemType: Array.isArray(first) ? "array" : first === null ? "null" : typeof first,
    firstItemKeys:
      first && typeof first === "object" && !Array.isArray(first) ? Object.keys(first).slice(0, 15) : [],
    firstItemSample: summarizeValue(first),
  };
}

async function safeFetch(url) {
  const headers = { Accept: "application/json,text/plain,*/*" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    const contentType = safeContentType(res.headers.get("content-type"));
    const text = await res.text();
    const trimmed = text.trim();

    let isJson = false;
    let json = null;
    if (trimmed.length > 0) {
      try {
        json = JSON.parse(trimmed);
        isJson = true;
      } catch {
        isJson = false;
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      contentType,
      isJson,
      json,
      textPreview: text.slice(0, 200),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      contentType: null,
      isJson: false,
      json: null,
      textPreview: null,
      error: error instanceof Error ? error.message : "unknown error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function expandEndpoints(definitions, baseUrl, tickers) {
  const jobs = [];

  for (const endpoint of definitions) {
    if (!endpoint.perTicker) {
      jobs.push({
        ...endpoint,
        ticker: null,
        resolvedPath: endpoint.path,
        url: `${baseUrl}${endpoint.path}`,
      });
      continue;
    }

    for (const ticker of tickers) {
      const normalizedPath = endpoint.path.replaceAll("{ticker}", encodeURIComponent(ticker));

      jobs.push({
        ...endpoint,
        ticker,
        resolvedPath: normalizedPath,
        url: `${baseUrl}${normalizedPath}`,
      });
    }
  }

  return jobs;
}

function analyzeJson(json) {
  const topLevelType = Array.isArray(json) ? "array" : json === null ? "null" : typeof json;
  const topLevelKeys = json && typeof json === "object" && !Array.isArray(json) ? Object.keys(json) : [];
  const nestedKeys = collectNestedKeys(json, 3);
  const topLevelSamples = sampleTopLevelValues(json, 5);
  const arraySample = Array.isArray(json) ? arrayFirstItemShape(json) : null;

  return {
    topLevelType,
    topLevelKeys,
    nestedKeys,
    topLevelSamples,
    arraySample,
  };
}

function buildPromisingEndpointList(results) {
  return results
    .filter((item) => item.response.isJson && item.response.status && item.response.status >= 200 && item.response.status < 300)
    .map((item) => {
      const keys =
        item.analysis?.topLevelKeys && item.analysis.topLevelKeys.length > 0
          ? item.analysis.topLevelKeys
          : item.analysis?.nestedKeys?.slice(0, 15) ?? [];
      return {
        endpoint: item.label,
        status: item.response.status,
        keys,
      };
    });
}

async function ensureOutputDirectory(filePath) {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
}

function formatLabel(job) {
  return `${job.group.toUpperCase()} ${job.resolvedPath}${job.ticker ? ` (${job.ticker})` : ""}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const selectedGroups = args.workerOnly ? ["worker"] : args.terminalOnly ? ["terminal"] : ["worker", "terminal"];
  const endpointJobs = [];

  if (selectedGroups.includes("worker")) {
    endpointJobs.push(...expandEndpoints(WORKER_ENDPOINTS, WORKER_BASE, args.tickers));
  }
  if (selectedGroups.includes("terminal")) {
    endpointJobs.push(...expandEndpoints(TERMINAL_ENDPOINTS, TERMINAL_BASE, args.tickers));
  }

  const startedAt = new Date().toISOString();
  const results = [];

  for (let index = 0; index < endpointJobs.length; index += 1) {
    const job = endpointJobs[index];
    const response = await safeFetch(job.url);
    const analysis = response.isJson ? analyzeJson(response.json) : null;
    const label = formatLabel(job);

    results.push({
      group: job.group,
      method: job.method,
      path: job.path,
      resolvedPath: job.resolvedPath,
      ticker: job.ticker,
      url: job.url,
      label,
      response,
      analysis,
      checkedAt: new Date().toISOString(),
    });

    console.log(`[${index + 1}/${endpointJobs.length}] ${label} -> ${response.status ?? "ERR"} ${response.isJson ? "json" : "non-json"}`);

    if (args.delayMs > 0 && index < endpointJobs.length - 1) {
      await sleep(args.delayMs);
    }
  }

  const totalChecked = results.length;
  const failedEndpoints = results.filter((item) => item.response.status === null || item.response.error);
  const nonJsonEndpoints = results.filter((item) => !item.response.isJson);
  const workingJsonEndpoints = results.filter(
    (item) => item.response.isJson && item.response.status && item.response.status >= 200 && item.response.status < 300
  );
  const promisingEndpoints = buildPromisingEndpointList(results);

  const inventory = {
    meta: {
      generatedAt: new Date().toISOString(),
      startedAt,
      finishedAt: new Date().toISOString(),
      delayMs: args.delayMs,
      tickers: args.tickers,
      workerBase: WORKER_BASE,
      terminalBase: TERMINAL_BASE,
      mode: args.workerOnly ? "worker-only" : args.terminalOnly ? "terminal-only" : "all",
    },
    summary: {
      totalChecked,
      workingJsonEndpoints: workingJsonEndpoints.length,
      nonJsonEndpoints: nonJsonEndpoints.length,
      failedEndpoints: failedEndpoints.length,
    },
    promisingEndpoints,
    results: results.map((item) => ({
      group: item.group,
      method: item.method,
      path: item.path,
      resolvedPath: item.resolvedPath,
      ticker: item.ticker,
      url: item.url,
      status: item.response.status,
      ok: item.response.ok,
      isJson: item.response.isJson,
      contentType: item.response.contentType,
      error: item.response.error,
      nonJsonPreview: item.response.isJson ? null : item.response.textPreview,
      topLevelKeys: item.analysis?.topLevelKeys ?? [],
      nestedKeysDepth3: item.analysis?.nestedKeys ?? [],
      topLevelSamples: item.analysis?.topLevelSamples ?? {},
      arrayFirstItemShape: item.analysis?.arraySample ?? null,
      checkedAt: item.checkedAt,
    })),
  };

  await ensureOutputDirectory(OUTPUT_FILE);
  await writeFile(OUTPUT_FILE, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");

  console.log("");
  console.log("PSX API Inventory Summary");
  console.log(`- total endpoints checked: ${totalChecked}`);
  console.log(`- working JSON endpoints: ${workingJsonEndpoints.length}`);
  console.log(`- non-JSON endpoints: ${nonJsonEndpoints.length}`);
  console.log(`- failed endpoints: ${failedEndpoints.length}`);
  console.log("- promising endpoints with keys found:");
  if (promisingEndpoints.length === 0) {
    console.log("  (none)");
  } else {
    for (const item of promisingEndpoints) {
      const keyPreview = item.keys.slice(0, 8).join(", ");
      console.log(`  - ${item.endpoint} [${item.status}] keys: ${keyPreview || "(no keys)"}${item.keys.length > 8 ? ", ..." : ""}`);
    }
  }
  console.log(`- output: ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(`[inventory:psx-api] fatal: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
