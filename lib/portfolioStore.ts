// Client-side portfolio persistence for guests (localStorage).
// Logged-in users sync via PortfolioProvider + server actions.

export type {
  Holding,
  Portfolio,
  Transaction,
  AccountActivity,
  PortfolioBundle,
  TradeResult,
  FundingResult,
} from "./portfolioTypes";

import type {
  AccountActivity,
  Portfolio,
  PortfolioBundle,
  FundingResult,
  TradeResult,
  Transaction,
} from "./portfolioTypes";
import {
  applyBuy,
  applyDeposit,
  applySell,
  applyWithdraw,
  defaultPortfolio,
  emptyBundle,
} from "./portfolioMutations";

const STORAGE_KEY = "psx_paper_portfolio_v1";
const HISTORY_KEY = "psx_paper_transactions_v1";
const ACCOUNT_ACTIVITY_KEY = "psx_paper_account_activity_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

const PORTFOLIO_EVENT = "psx-portfolio-updated";

function notifyPortfolioChanged(): void {
  if (isBrowser()) {
    window.dispatchEvent(new Event(PORTFOLIO_EVENT));
  }
}

function readBundle(): PortfolioBundle {
  if (!isBrowser()) return emptyBundle();
  try {
    const rawP = localStorage.getItem(STORAGE_KEY);
    const rawT = localStorage.getItem(HISTORY_KEY);
    const rawA = localStorage.getItem(ACCOUNT_ACTIVITY_KEY);
    let portfolio: Portfolio = defaultPortfolio();
    if (rawP) {
      const parsed = JSON.parse(rawP) as Portfolio;
      if (typeof parsed.cash === "number" && Array.isArray(parsed.holdings)) {
        portfolio = parsed;
      }
    }
    let transactions: Transaction[] = [];
    if (rawT) {
      const arr = JSON.parse(rawT) as Transaction[];
      if (Array.isArray(arr)) transactions = arr;
    }
    let accountActivity: AccountActivity[] = [];
    if (rawA) {
      const arr = JSON.parse(rawA) as AccountActivity[];
      if (Array.isArray(arr)) accountActivity = arr;
    }
    return { portfolio, transactions, accountActivity };
  } catch {
    return emptyBundle();
  }
}

function writeBundle(b: PortfolioBundle): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(b.portfolio));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(b.transactions));
  localStorage.setItem(ACCOUNT_ACTIVITY_KEY, JSON.stringify(b.accountActivity));
}

export function getPortfolio(): Portfolio {
  return readBundle().portfolio;
}

export function getTransactionHistory(): Transaction[] {
  return readBundle().transactions;
}

export function getAccountActivity(): AccountActivity[] {
  return readBundle().accountActivity;
}

export function getGuestPortfolioBundle(): PortfolioBundle {
  return readBundle();
}

export function setGuestPortfolioBundle(bundle: PortfolioBundle): void {
  writeBundle(bundle);
  notifyPortfolioChanged();
}

export function buyStock(
  ticker: string,
  shares: number,
  price: number
): TradeResult {
  const bundle = readBundle();
  const { result, bundle: next } = applyBuy(bundle, ticker, shares, price);
  if (!result.ok || !next) return result;
  writeBundle(next);
  notifyPortfolioChanged();
  return { ok: true };
}

export function sellStock(
  ticker: string,
  shares: number,
  price: number
): TradeResult {
  const bundle = readBundle();
  const { result, bundle: next } = applySell(bundle, ticker, shares, price);
  if (!result.ok || !next) return result;
  writeBundle(next);
  notifyPortfolioChanged();
  return { ok: true };
}

export function depositVirtualFunds(
  amount: number,
  method = "Manual Deposit"
): FundingResult {
  const bundle = readBundle();
  const { result, bundle: next } = applyDeposit(bundle, amount, method);
  if (!result.ok || !next) return result;
  writeBundle(next);
  notifyPortfolioChanged();
  return result;
}

export function withdrawVirtualFunds(
  amount: number,
  method = "Manual Withdrawal"
): FundingResult {
  const bundle = readBundle();
  const { result, bundle: next } = applyWithdraw(bundle, amount, method);
  if (!result.ok || !next) return result;
  writeBundle(next);
  notifyPortfolioChanged();
  return result;
}
