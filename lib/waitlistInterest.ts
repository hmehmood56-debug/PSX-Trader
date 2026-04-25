export const REAL_TRADING_INTEREST_OPTIONS = [
  { id: "psx_stocks", label: "PSX Stocks" },
  { id: "us_stocks", label: "US Stocks" },
  { id: "crypto", label: "Crypto" },
  { id: "forex", label: "Forex" },
] as const;

export type RealTradingInterestId = (typeof REAL_TRADING_INTEREST_OPTIONS)[number]["id"];
