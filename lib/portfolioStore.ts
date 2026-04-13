// Client-side portfolio persistence. Swap for REST/GraphQL by implementing
// the same function signatures against your backend.

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

const STORAGE_KEY = "psx_paper_portfolio_v1";
const HISTORY_KEY = "psx_paper_transactions_v1";
const ACCOUNT_ACTIVITY_KEY = "psx_paper_account_activity_v1";
const STARTING_CASH = 1_000_000;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

const PORTFOLIO_EVENT = "psx-portfolio-updated";

function notifyPortfolioChanged(): void {
  if (isBrowser()) {
    window.dispatchEvent(new Event(PORTFOLIO_EVENT));
  }
}

function defaultPortfolio(): Portfolio {
  return { cash: STARTING_CASH, holdings: [] };
}

export function getPortfolio(): Portfolio {
  if (!isBrowser()) return defaultPortfolio();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPortfolio();
    const parsed = JSON.parse(raw) as Portfolio;
    if (
      typeof parsed.cash !== "number" ||
      !Array.isArray(parsed.holdings)
    ) {
      return defaultPortfolio();
    }
    return parsed;
  } catch {
    return defaultPortfolio();
  }
}

function savePortfolio(p: Portfolio): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

function loadHistory(): Transaction[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Transaction[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveHistory(txs: Transaction[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(txs));
}

function loadAccountActivity(): AccountActivity[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(ACCOUNT_ACTIVITY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as AccountActivity[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveAccountActivity(items: AccountActivity[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(ACCOUNT_ACTIVITY_KEY, JSON.stringify(items));
}

function pushAccountActivity(item: AccountActivity): void {
  const all = loadAccountActivity();
  all.unshift(item);
  saveAccountActivity(all.slice(0, 200));
}

function pushTransaction(t: Transaction): void {
  const all = loadHistory();
  all.unshift(t);
  saveHistory(all.slice(0, 500));
}

export type TradeResult =
  | { ok: true }
  | { ok: false; error: string };

export type FundingResult =
  | { ok: true; newCashBalance: number }
  | { ok: false; error: string };

export function buyStock(
  ticker: string,
  shares: number,
  price: number
): TradeResult {
  const t = ticker.toUpperCase();
  if (!Number.isFinite(shares) || shares <= 0 || !Number.isInteger(shares)) {
    return { ok: false, error: "Shares must be a positive whole number." };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: "Invalid price." };
  }
  const cost = shares * price;
  const p = getPortfolio();
  if (cost > p.cash + 1e-9) {
    return { ok: false, error: "Insufficient cash for this order." };
  }
  const idx = p.holdings.findIndex((h) => h.ticker === t);
  let holdings = [...p.holdings];
  if (idx === -1) {
    holdings.push({ ticker: t, shares, avgBuyPrice: price });
  } else {
    const h = holdings[idx];
    const newShares = h.shares + shares;
    const avg =
      (h.avgBuyPrice * h.shares + price * shares) / (h.shares + shares);
    holdings[idx] = {
      ticker: t,
      shares: newShares,
      avgBuyPrice: Number(avg.toFixed(4)),
    };
  }
  const next: Portfolio = {
    cash: Number((p.cash - cost).toFixed(2)),
    holdings,
  };
  savePortfolio(next);
  pushTransaction({
    id: crypto.randomUUID(),
    type: "BUY",
    ticker: t,
    shares,
    price,
    total: Number(cost.toFixed(2)),
    timestamp: new Date().toISOString(),
  });
  notifyPortfolioChanged();
  return { ok: true };
}

export function sellStock(
  ticker: string,
  shares: number,
  price: number
): TradeResult {
  const t = ticker.toUpperCase();
  if (!Number.isFinite(shares) || shares <= 0 || !Number.isInteger(shares)) {
    return { ok: false, error: "Shares must be a positive whole number." };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: "Invalid price." };
  }
  const p = getPortfolio();
  const idx = p.holdings.findIndex((h) => h.ticker === t);
  if (idx === -1) {
    return { ok: false, error: "You do not own this stock." };
  }
  const h = p.holdings[idx];
  if (h.shares < shares) {
    return { ok: false, error: "Not enough shares to sell." };
  }
  const proceeds = shares * price;
  let holdings = [...p.holdings];
  if (h.shares === shares) {
    holdings.splice(idx, 1);
  } else {
    holdings[idx] = { ...h, shares: h.shares - shares };
  }
  const next: Portfolio = {
    cash: Number((p.cash + proceeds).toFixed(2)),
    holdings,
  };
  savePortfolio(next);
  pushTransaction({
    id: crypto.randomUUID(),
    type: "SELL",
    ticker: t,
    shares,
    price,
    total: Number(proceeds.toFixed(2)),
    timestamp: new Date().toISOString(),
  });
  notifyPortfolioChanged();
  return { ok: true };
}

export function getTransactionHistory(): Transaction[] {
  return loadHistory();
}

export function depositVirtualFunds(amount: number, method = "Manual Deposit"): FundingResult {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter a valid funding amount." };
  }

  const roundedAmount = Number(amount.toFixed(2));
  const p = getPortfolio();
  const nextCash = Number((p.cash + roundedAmount).toFixed(2));
  const next: Portfolio = {
    cash: nextCash,
    holdings: p.holdings,
  };

  savePortfolio(next);
  pushAccountActivity({
    id: crypto.randomUUID(),
    kind: "DEPOSIT",
    method,
    amount: roundedAmount,
    timestamp: new Date().toISOString(),
  });
  notifyPortfolioChanged();
  return { ok: true, newCashBalance: nextCash };
}

export function withdrawVirtualFunds(
  amount: number,
  method = "Manual Withdrawal"
): FundingResult {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter a valid withdrawal amount." };
  }

  const roundedAmount = Number(amount.toFixed(2));
  const p = getPortfolio();
  if (roundedAmount > p.cash + 1e-9) {
    return { ok: false, error: "Insufficient virtual cash for this withdrawal." };
  }

  const nextCash = Number((p.cash - roundedAmount).toFixed(2));
  const next: Portfolio = {
    cash: nextCash,
    holdings: p.holdings,
  };

  savePortfolio(next);
  pushAccountActivity({
    id: crypto.randomUUID(),
    kind: "WITHDRAWAL",
    method,
    amount: roundedAmount,
    timestamp: new Date().toISOString(),
  });
  notifyPortfolioChanged();
  return { ok: true, newCashBalance: nextCash };
}

export function getAccountActivity(): AccountActivity[] {
  return loadAccountActivity();
}
