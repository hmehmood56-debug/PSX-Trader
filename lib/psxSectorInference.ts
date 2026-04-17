import { getReplayProfileByTicker } from "./replayDataset";

/** PSX Terminal ticks do not include sector; map liquid names + sensible heuristics. */
const TICKER_TO_SECTOR: Record<string, string> = {
  // Banks & finance
  ABL: "Banking",
  AKBL: "Banking",
  BAFL: "Banking",
  BAHL: "Banking",
  BIPL: "Banking",
  BML: "Banking",
  BOK: "Banking",
  FABL: "Banking",
  FWBL: "Banking",
  HBL: "Banking",
  HMB: "Banking",
  JSBL: "Banking",
  JSGBL: "Banking",
  MCB: "Banking",
  MEBL: "Banking",
  MBIL: "Banking",
  NBP: "Banking",
  SCBPL: "Banking",
  SILK: "Banking",
  SNBL: "Banking",
  UBL: "Banking",
  AKDSL: "Inv. banks / securities",
  AKDHL: "Inv. banks / securities",
  IBFL: "Inv. banks / securities",
  IGIHL: "Inv. banks / securities",
  // Cement
  LUCK: "Cement",
  DGKC: "Cement",
  MLCF: "Cement",
  CHCC: "Cement",
  FCCL: "Cement",
  KOHC: "Cement",
  PIOC: "Cement",
  POWER: "Cement",
  PRL: "Cement",
  DCL: "Cement",
  BWCL: "Cement",
  GCWL: "Cement",
  FECTC: "Cement",
  JVDC: "Cement",
  DVML: "Cement",
  // Oil & gas upstream / midstream
  OGDC: "Oil & gas",
  PPL: "Oil & gas",
  POL: "Oil & gas",
  MARI: "Oil & gas",
  PEL: "Oil & gas",
  PHPL: "Oil & gas",
  // Marketing & refineries
  PSO: "Oil marketing",
  SHEL: "Oil marketing",
  HASCOL: "Oil marketing",
  ATRL: "Refinery",
  NRL: "Refinery",
  BYCO: "Refinery",
  // Fertilizer & chemicals
  EFERT: "Fertilizer",
  FFBL: "Fertilizer",
  FATIMA: "Fertilizer",
  EFUG: "Fertilizer",
  EFUL: "Fertilizer",
  EPCL: "Chemicals",
  LOTCHEM: "Chemicals",
  ICI: "Chemicals",
  COLG: "Household & personal care",
  // Power
  HUBC: "Power",
  KAPCO: "Power",
  NKEL: "Power",
  LPL: "Power",
  NCPL: "Power",
  PKGP: "Power",
  // Technology & telecoms
  TRG: "Technology",
  SYS: "Technology",
  AVN: "Technology",
  NETSOL: "Technology",
  PTC: "Telecommunications",
  TPL: "Telecommunications",
  WTL: "Telecommunications",
  // Pharma & health
  SEARL: "Pharmaceuticals",
  AGP: "Pharmaceuticals",
  GLAXO: "Pharmaceuticals",
  HINOON: "Pharmaceuticals",
  HINO: "Pharmaceuticals",
  // Autos
  INDU: "Automobiles",
  HCAR: "Automobiles",
  GHNI: "Automobiles",
  AGTL: "Automobiles",
  ATBA: "Automobiles",
  GTYR: "Automobiles",
  // Textiles
  NML: "Textile",
  GATM: "Textile",
  NCL: "Textile",
  KTML: "Textile",
  // Steel & engineering
  ASTL: "Steel",
  ASL: "Engineering",
  ATIL: "Engineering",
  // Food & staples
  ENGRO: "Conglomerate",
  NESTL: "Food & consumer",
  NATF: "Food & consumer",
  // Tobacco & sugar
  PAKT: "Tobacco",
  MUREB: "Tobacco",
  JDWS: "Sugar",
  SML: "Sugar",
  // Glass & packaging
  GGL: "Glass",
  TGCL: "Glass",
  // Insurance & modaraba
  ALAC: "Insurance",
  // ETFs / funds
  HBLTETF: "ETFs & index products",
  ACIETF: "ETFs & index products",
  IREIT: "REIT",
};

function sectorFromTickerHeuristics(upper: string): string | undefined {
  if (upper.endsWith("ETF")) return "ETFs & index products";
  if (upper.includes("REIT")) return "REIT";
  if (upper.endsWith("MOD")) return "Modaraba";

  const bankLike =
    /(BANK|BAFL|BAHL|BL$)/.test(upper) &&
    upper.length >= 3 &&
    upper.length <= 5 &&
    !["TRG", "SYS", "AVN", "AIR", "OIL", "GAS", "BBL"].includes(upper);
  if (bankLike && (upper.endsWith("BL") || upper.includes("BANK"))) {
    return "Banking";
  }

  if (/(CEM|CEMENT|DGKC|FCCL|LUCK|MLCF|CHCC|KOHC|PIOC)/i.test(upper)) return "Cement";
  if (/(OGDC|PPL|POL|MARI|PEL)/i.test(upper)) return "Oil & gas";
  if (/(PSO|SHEL|HASCOL)/i.test(upper)) return "Oil marketing";
  if (/(ATRL|NRL|BYCO)/i.test(upper)) return "Refinery";
  if (/(EFERT|FFBL|FATIMA|EFUG|EFUL)/i.test(upper)) return "Fertilizer";
  if (/(TRG|SYS|NETSOL|AVN|TECH|SOFT|DATA)/i.test(upper)) return "Technology";
  if (/(SEARL|AGP|GLAXO|PHAR|DRUG|GENO)/i.test(upper)) return "Pharmaceuticals";
  if (/(HUBC|KAPCO|NKEL|LPL|NCPL|PKGP|POWER)/i.test(upper)) return "Power";
  if (/(INDU|HCAR|GHNI|AGTL|ATBA|MOTOR|AUTO)/i.test(upper)) return "Automobiles";
  if (/(NML|GATM|TEXT|SPIN|DENIM|SML)/i.test(upper)) return "Textile";
  if (/(STEEL|IRON|METAL)/i.test(upper)) return "Steel";

  return undefined;
}

export function inferPsxListingSector(ticker: string): string {
  const upper = ticker.trim().toUpperCase();
  const curated = getReplayProfileByTicker(upper);
  if (curated) return curated.sector;

  const mapped = TICKER_TO_SECTOR[upper];
  if (mapped) return mapped;

  return sectorFromTickerHeuristics(upper) ?? "Diversified listings";
}
