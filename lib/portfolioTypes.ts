export type Holding = {
  ticker: string;
  shares: number;
  avgBuyPrice: number;
};

export type Portfolio = {
  cash: number;
  holdings: Holding[];
};

export type Transaction = {
  id: string;
  type: "BUY" | "SELL";
  ticker: string;
  shares: number;
  price: number;
  total: number;
  timestamp: string;
};

export type AccountActivity = {
  id: string;
  kind: "DEPOSIT" | "WITHDRAWAL";
  method: string;
  amount: number;
  timestamp: string;
};

export type PortfolioBundle = {
  portfolio: Portfolio;
  transactions: Transaction[];
  accountActivity: AccountActivity[];
};

export type TradeResult =
  | { ok: true }
  | { ok: false; error: string };

export type FundingResult =
  | { ok: true; newCashBalance: number }
  | { ok: false; error: string };
