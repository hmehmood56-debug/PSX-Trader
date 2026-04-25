import type {
  AccountActivity,
  Portfolio,
  PortfolioBundle,
  FundingResult,
  TradeResult,
  Transaction,
} from "./portfolioTypes";

function cloneBundle(b: PortfolioBundle): PortfolioBundle {
  return {
    portfolio: {
      cash: b.portfolio.cash,
      holdings: b.portfolio.holdings.map((h) => ({ ...h })),
    },
    transactions: [...b.transactions],
    accountActivity: [...b.accountActivity],
  };
}

export function applyBuy(
  bundle: PortfolioBundle,
  ticker: string,
  shares: number,
  price: number
): { result: TradeResult; bundle?: PortfolioBundle } {
  const t = ticker.toUpperCase();
  if (!Number.isFinite(shares) || shares <= 0 || !Number.isInteger(shares)) {
    return { result: { ok: false, error: "Shares must be a positive whole number." } };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { result: { ok: false, error: "Invalid price." } };
  }
  const cost = shares * price;
  const p = bundle.portfolio;
  if (cost > p.cash + 1e-9) {
    return { result: { ok: false, error: "Insufficient cash for this order." } };
  }
  const next = cloneBundle(bundle);
  const idx = next.portfolio.holdings.findIndex((h) => h.ticker === t);
  let holdings = [...next.portfolio.holdings];
  if (idx === -1) {
    holdings.push({ ticker: t, shares, avgBuyPrice: price });
  } else {
    const h = holdings[idx];
    const newShares = h.shares + shares;
    const avg = (h.avgBuyPrice * h.shares + price * shares) / (h.shares + shares);
    holdings[idx] = {
      ticker: t,
      shares: newShares,
      avgBuyPrice: Number(avg.toFixed(4)),
    };
  }
  next.portfolio = {
    cash: Number((p.cash - cost).toFixed(2)),
    holdings,
  };
  const tx: Transaction = {
    id: crypto.randomUUID(),
    type: "BUY",
    ticker: t,
    shares,
    price,
    total: Number(cost.toFixed(2)),
    timestamp: new Date().toISOString(),
  };
  next.transactions = [tx, ...next.transactions].slice(0, 500);
  return { result: { ok: true }, bundle: next };
}

export function applySell(
  bundle: PortfolioBundle,
  ticker: string,
  shares: number,
  price: number
): { result: TradeResult; bundle?: PortfolioBundle } {
  const t = ticker.toUpperCase();
  if (!Number.isFinite(shares) || shares <= 0 || !Number.isInteger(shares)) {
    return { result: { ok: false, error: "Shares must be a positive whole number." } };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { result: { ok: false, error: "Invalid price." } };
  }
  const p = bundle.portfolio;
  const idx = p.holdings.findIndex((h) => h.ticker === t);
  if (idx === -1) {
    return { result: { ok: false, error: "You do not own this stock." } };
  }
  const h = p.holdings[idx];
  if (h.shares < shares) {
    return { result: { ok: false, error: "Not enough shares to sell." } };
  }
  const proceeds = shares * price;
  const next = cloneBundle(bundle);
  let holdings = [...next.portfolio.holdings];
  if (h.shares === shares) {
    holdings.splice(idx, 1);
  } else {
    holdings[idx] = { ...h, shares: h.shares - shares };
  }
  next.portfolio = {
    cash: Number((p.cash + proceeds).toFixed(2)),
    holdings,
  };
  const tx: Transaction = {
    id: crypto.randomUUID(),
    type: "SELL",
    ticker: t,
    shares,
    price,
    total: Number(proceeds.toFixed(2)),
    timestamp: new Date().toISOString(),
  };
  next.transactions = [tx, ...next.transactions].slice(0, 500);
  return { result: { ok: true }, bundle: next };
}

export function applyDeposit(
  bundle: PortfolioBundle,
  amount: number,
  method = "Manual Deposit"
): { result: FundingResult; bundle?: PortfolioBundle } {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { result: { ok: false, error: "Enter a valid funding amount." } };
  }
  const roundedAmount = Number(amount.toFixed(2));
  const p = bundle.portfolio;
  const nextCash = Number((p.cash + roundedAmount).toFixed(2));
  const next = cloneBundle(bundle);
  next.portfolio = { cash: nextCash, holdings: p.holdings };
  const item: AccountActivity = {
    id: crypto.randomUUID(),
    kind: "DEPOSIT",
    method,
    amount: roundedAmount,
    timestamp: new Date().toISOString(),
  };
  next.accountActivity = [item, ...next.accountActivity].slice(0, 200);
  return { result: { ok: true, newCashBalance: nextCash }, bundle: next };
}

export function applyWithdraw(
  bundle: PortfolioBundle,
  amount: number,
  method = "Manual Withdrawal"
): { result: FundingResult; bundle?: PortfolioBundle } {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { result: { ok: false, error: "Enter a valid withdrawal amount." } };
  }
  const roundedAmount = Number(amount.toFixed(2));
  const p = bundle.portfolio;
  if (roundedAmount > p.cash + 1e-9) {
    return { result: { ok: false, error: "Insufficient virtual cash for this withdrawal." } };
  }
  const nextCash = Number((p.cash - roundedAmount).toFixed(2));
  const next = cloneBundle(bundle);
  next.portfolio = { cash: nextCash, holdings: p.holdings };
  const item: AccountActivity = {
    id: crypto.randomUUID(),
    kind: "WITHDRAWAL",
    method,
    amount: roundedAmount,
    timestamp: new Date().toISOString(),
  };
  next.accountActivity = [item, ...next.accountActivity].slice(0, 200);
  return { result: { ok: true, newCashBalance: nextCash }, bundle: next };
}

export function defaultPortfolio(): Portfolio {
  return { cash: 1_000_000, holdings: [] };
}

export function emptyBundle(): PortfolioBundle {
  return {
    portfolio: defaultPortfolio(),
    transactions: [],
    accountActivity: [],
  };
}
