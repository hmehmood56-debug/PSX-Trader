import { readFileSync } from "node:fs";
import path from "node:path";

export type NccplSectorFlowDirection = "inflow" | "outflow" | "flat";

export type NccplSectorFlow = {
  sector: string;
  buy: number;
  sell: number;
  net: number;
  totalActivity: number;
  direction: NccplSectorFlowDirection;
};

export type NccplForeignActivity = {
  sessionDate: string;
  updatedAt: string;
  sourceName: "NCCPL";
  sourceUrl: "https://beta.nccpl.com.pk/market-information";
  foreignBuy: number;
  foreignSell: number;
  foreignNet: number;
  currency: "PKR";
  sectors: NccplSectorFlow[];
};

const NCCPL_FOREIGN_ACTIVITY_FILE = path.resolve(
  process.cwd(),
  "data/nccpl/foreign-investor-activity.latest.json"
);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isDirection(value: unknown): value is NccplSectorFlowDirection {
  return value === "inflow" || value === "outflow" || value === "flat";
}

function isIsoDateLike(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value);
}

function parseSectorFlow(value: unknown): NccplSectorFlow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.sector !== "string" || row.sector.trim().length === 0) return null;
  if (!isFiniteNumber(row.buy) || !isFiniteNumber(row.sell) || !isFiniteNumber(row.net)) return null;
  if (!isFiniteNumber(row.totalActivity) || !isDirection(row.direction)) return null;
  return {
    sector: row.sector,
    buy: row.buy,
    sell: row.sell,
    net: row.net,
    totalActivity: row.totalActivity,
    direction: row.direction,
  };
}

export function isNccplForeignActivity(value: unknown): value is NccplForeignActivity {
  if (!value || typeof value !== "object") return false;
  const root = value as Record<string, unknown>;

  if (!isIsoDateLike(root.sessionDate) || typeof root.updatedAt !== "string") return false;
  if (root.sourceName !== "NCCPL") return false;
  if (root.sourceUrl !== "https://beta.nccpl.com.pk/market-information") return false;
  if (root.currency !== "PKR") return false;
  if (!isFiniteNumber(root.foreignBuy) || !isFiniteNumber(root.foreignSell) || !isFiniteNumber(root.foreignNet)) {
    return false;
  }
  if (!Array.isArray(root.sectors)) return false;

  const sectors = root.sectors.map(parseSectorFlow);
  if (sectors.some((row) => row === null)) return false;

  const computedNet = root.foreignBuy - root.foreignSell;
  if (Math.abs(computedNet - root.foreignNet) > 1e-6) return false;

  for (const row of sectors) {
    if (!row) continue;
    if (Math.abs((row.buy + row.sell) - row.totalActivity) > 1e-6) return false;
    const expectedDirection: NccplSectorFlowDirection =
      row.net > 0 ? "inflow" : row.net < 0 ? "outflow" : "flat";
    if (row.direction !== expectedDirection) return false;
  }

  return true;
}

export function getLatestNccplForeignActivity(): NccplForeignActivity | null {
  try {
    const raw = readFileSync(NCCPL_FOREIGN_ACTIVITY_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return isNccplForeignActivity(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function getNccplForeignActivityFilePath(): string {
  return NCCPL_FOREIGN_ACTIVITY_FILE;
}
