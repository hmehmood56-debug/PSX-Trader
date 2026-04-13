// TO SWAP FOR REAL API: Replace this file with your data provider integration
// Expected shape: Stock { ticker, name, sector, price, change, changePercent, volume, marketCap, high52, low52, description }
// Recommended providers: Mettis Global, KSE Live API

export type Stock = {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  high52: number;
  low52: number;
  description: string;
};

// Baseline snapshot; live UI prices come from PriceSimulatorProvider
export const MOCK_STOCKS: Stock[] = [
  {
    ticker: "OGDC",
    name: "Oil & Gas Development Company",
    sector: "Energy",
    price: 180.25,
    change: 2.15,
    changePercent: 1.21,
    volume: 4_250_000,
    marketCap: 775_000_000_000,
    high52: 198.4,
    low52: 152.1,
    description:
      "OGDC is one of Pakistan's largest exploration and production companies, focused on hydrocarbon development across the country.",
  },
  {
    ticker: "HBL",
    name: "Habib Bank Limited",
    sector: "Banking",
    price: 139.8,
    change: -0.65,
    changePercent: -0.46,
    volume: 3_100_000,
    marketCap: 205_000_000_000,
    high52: 152.0,
    low52: 118.3,
    description:
      "HBL is a leading commercial bank in Pakistan with a broad retail and corporate footprint and regional presence.",
  },
  {
    ticker: "LUCK",
    name: "Lucky Cement Limited",
    sector: "Cement",
    price: 905.5,
    change: 12.25,
    changePercent: 1.37,
    volume: 890_000,
    marketCap: 293_000_000_000,
    high52: 940.0,
    low52: 780.0,
    description:
      "Lucky Cement is a major cement producer in Pakistan with integrated operations and export-oriented capacity.",
  },
  {
    ticker: "PSO",
    name: "Pakistan State Oil",
    sector: "Energy",
    price: 268.4,
    change: 1.9,
    changePercent: 0.71,
    volume: 2_400_000,
    marketCap: 126_000_000_000,
    high52: 285.6,
    low52: 235.2,
    description:
      "PSO is Pakistan's largest oil marketing company, distributing fuels and lubricants nationwide.",
  },
  {
    ticker: "ENGRO",
    name: "Engro Corporation Limited",
    sector: "Conglomerate",
    price: 292.75,
    change: -1.25,
    changePercent: -0.43,
    volume: 1_050_000,
    marketCap: 141_000_000_000,
    high52: 318.0,
    low52: 265.4,
    description:
      "Engro operates across fertilizers, foods, energy, and petrochemicals with a diversified industrial portfolio.",
  },
  {
    ticker: "UBL",
    name: "United Bank Limited",
    sector: "Banking",
    price: 178.6,
    change: 0.85,
    changePercent: 0.48,
    volume: 2_200_000,
    marketCap: 218_000_000_000,
    high52: 189.5,
    low52: 155.2,
    description:
      "UBL provides retail, corporate, and Islamic banking services with a strong domestic branch network.",
  },
  {
    ticker: "MCB",
    name: "MCB Bank Limited",
    sector: "Banking",
    price: 211.3,
    change: -0.9,
    changePercent: -0.42,
    volume: 1_650_000,
    marketCap: 249_000_000_000,
    high52: 225.0,
    low52: 188.0,
    description:
      "MCB Bank is a systemically important bank in Pakistan known for digital innovation and asset quality.",
  },
  {
    ticker: "HUBC",
    name: "The Hub Power Company",
    sector: "Power",
    price: 91.15,
    change: 0.45,
    changePercent: 0.5,
    volume: 5_800_000,
    marketCap: 118_000_000_000,
    high52: 102.4,
    low52: 76.8,
    description:
      "HUBC operates large thermal power assets and is a key player in Pakistan's independent power producer sector.",
  },
  {
    ticker: "TRG",
    name: "TRG Pakistan Limited",
    sector: "Technology",
    price: 98.2,
    change: -2.1,
    changePercent: -2.09,
    volume: 12_500_000,
    marketCap: 42_000_000_000,
    high52: 135.0,
    low52: 72.5,
    description:
      "TRG Pakistan is linked to global BPO and technology services through its international affiliate structure.",
  },
  {
    ticker: "BAFL",
    name: "Bank Alfalah Limited",
    sector: "Banking",
    price: 44.85,
    change: 0.22,
    changePercent: 0.49,
    volume: 8_900_000,
    marketCap: 79_000_000_000,
    high52: 48.6,
    low52: 38.1,
    description:
      "Bank Alfalah offers retail, corporate, Islamic, and consumer banking with a growing digital franchise.",
  },
  {
    ticker: "MARI",
    name: "Mari Petroleum Company",
    sector: "Energy",
    price: 1798.0,
    change: 24.5,
    changePercent: 1.38,
    volume: 125_000,
    marketCap: 240_000_000_000,
    high52: 1925.0,
    low52: 1520.0,
    description:
      "Mari Petroleum focuses on natural gas production from the Mari field and adjacent exploration blocks.",
  },
  {
    ticker: "SEARL",
    name: "The Searle Company Limited",
    sector: "Pharmaceuticals",
    price: 79.45,
    change: -0.55,
    changePercent: -0.69,
    volume: 620_000,
    marketCap: 18_500_000_000,
    high52: 88.2,
    low52: 66.4,
    description:
      "Searle manufactures pharmaceuticals, nutraceuticals, and consumer health products for domestic markets.",
  },
  {
    ticker: "KOHC",
    name: "Kohinoor Energy Limited",
    sector: "Power",
    price: 182.3,
    change: 1.1,
    changePercent: 0.61,
    volume: 210_000,
    marketCap: 5_200_000_000,
    high52: 198.0,
    low52: 155.0,
    description:
      "Kohinoor Energy operates power generation capacity serving industrial and grid demand in Pakistan.",
  },
  {
    ticker: "MLCF",
    name: "Maple Leaf Cement Factory",
    sector: "Cement",
    price: 39.6,
    change: -0.35,
    changePercent: -0.88,
    volume: 3_400_000,
    marketCap: 21_000_000_000,
    high52: 45.2,
    low52: 33.8,
    description:
      "Maple Leaf Cement is an established cement manufacturer with plants serving construction demand.",
  },
  {
    ticker: "DGKC",
    name: "D.G. Khan Cement Company",
    sector: "Cement",
    price: 81.9,
    change: 0.65,
    changePercent: 0.8,
    volume: 2_750_000,
    marketCap: 36_000_000_000,
    high52: 89.4,
    low52: 68.2,
    description:
      "DG Khan Cement operates large-scale cement production with distribution across Pakistan.",
  },
];

export function getStockByTicker(ticker: string): Stock | undefined {
  return MOCK_STOCKS.find(
    (s) => s.ticker.toUpperCase() === ticker.toUpperCase()
  );
}

export function getAllSectors(): string[] {
  return Array.from(new Set(MOCK_STOCKS.map((s) => s.sector))).sort();
}
