import type { PortfolioBundle } from "@/lib/portfolioTypes";
import { getGuestPortfolioBundle, setGuestPortfolioBundle } from "@/lib/portfolioStore";

function cloneBundle(bundle: PortfolioBundle): PortfolioBundle {
  return {
    portfolio: {
      cash: bundle.portfolio.cash,
      holdings: bundle.portfolio.holdings.map((h) => ({ ...h })),
    },
    transactions: [...bundle.transactions],
    accountActivity: [...bundle.accountActivity],
  };
}

export function deductGuestVirtualCash(
  amount: number
): { ok: true; newCash: number } | { ok: false; error: string } {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Invalid amount." };
  }
  const bundle = getGuestPortfolioBundle();
  if (bundle.portfolio.cash + 1e-9 < amount) {
    return { ok: false, error: "Insufficient virtual cash." };
  }
  const next = cloneBundle(bundle);
  next.portfolio.cash = Number((next.portfolio.cash - amount).toFixed(2));
  setGuestPortfolioBundle(next);
  return { ok: true, newCash: next.portfolio.cash };
}
