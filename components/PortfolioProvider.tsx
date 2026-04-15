"use client";

import {
  loadRemotePortfolio,
  remoteBuyStock,
  remoteDepositVirtualFunds,
  remoteSellStock,
  remoteWithdrawVirtualFunds,
} from "@/app/actions/portfolio";
import { useAuth } from "@/components/auth/AuthProvider";
import type {
  AccountActivity,
  FundingResult,
  Portfolio,
  PortfolioBundle,
  TradeResult,
  Transaction,
} from "@/lib/portfolioTypes";
import {
  buyStock as guestBuyStock,
  depositVirtualFunds as guestDeposit,
  getGuestPortfolioBundle,
  sellStock as guestSellStock,
  withdrawVirtualFunds as guestWithdraw,
} from "@/lib/portfolioStore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const PORTFOLIO_EVENT = "psx-portfolio-updated";

export type PortfolioContextValue = {
  portfolio: Portfolio;
  transactions: Transaction[];
  accountActivity: AccountActivity[];
  /** True once guest localStorage or remote snapshot has been applied. */
  portfolioReady: boolean;
  isAuthenticated: boolean;
  buyStock: (ticker: string, shares: number, price: number) => Promise<TradeResult>;
  sellStock: (ticker: string, shares: number, price: number) => Promise<TradeResult>;
  depositVirtualFunds: (amount: number, method?: string) => Promise<FundingResult>;
  withdrawVirtualFunds: (amount: number, method?: string) => Promise<FundingResult>;
  refreshPortfolio: () => Promise<void>;
};

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

function defaultPortfolio(): Portfolio {
  return { cash: 1_000_000, holdings: [] };
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio>(defaultPortfolio);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accountActivity, setAccountActivity] = useState<AccountActivity[]>([]);
  const [portfolioReady, setPortfolioReady] = useState(false);

  const applyBundle = useCallback((b: PortfolioBundle) => {
    setPortfolio(b.portfolio);
    setTransactions(b.transactions);
    setAccountActivity(b.accountActivity);
  }, []);

  const refreshPortfolio = useCallback(async () => {
    if (!user) {
      applyBundle(getGuestPortfolioBundle());
      setPortfolioReady(true);
      return;
    }
    const res = await loadRemotePortfolio();
    if (res.ok) {
      applyBundle(res.bundle);
    } else {
      applyBundle(getGuestPortfolioBundle());
    }
    setPortfolioReady(true);
  }, [user, applyBundle]);

  useEffect(() => {
    if (authLoading) {
      setPortfolioReady(false);
      return;
    }
    void refreshPortfolio();
  }, [authLoading, refreshPortfolio]);

  useEffect(() => {
    if (user) return;
    const onUpdate = () => {
      applyBundle(getGuestPortfolioBundle());
    };
    window.addEventListener(PORTFOLIO_EVENT, onUpdate);
    return () => window.removeEventListener(PORTFOLIO_EVENT, onUpdate);
  }, [user, applyBundle]);

  const buyStock = useCallback(
    async (ticker: string, shares: number, price: number): Promise<TradeResult> => {
      if (user) {
        const res = await remoteBuyStock(ticker, shares, price);
        if (res.ok) {
          applyBundle(res.bundle);
          window.dispatchEvent(new Event(PORTFOLIO_EVENT));
          return { ok: true };
        }
        return { ok: false, error: res.error };
      }
      const out = guestBuyStock(ticker, shares, price);
      if (out.ok) {
        applyBundle(getGuestPortfolioBundle());
      }
      return out;
    },
    [user, applyBundle]
  );

  const sellStock = useCallback(
    async (ticker: string, shares: number, price: number): Promise<TradeResult> => {
      if (user) {
        const res = await remoteSellStock(ticker, shares, price);
        if (res.ok) {
          applyBundle(res.bundle);
          window.dispatchEvent(new Event(PORTFOLIO_EVENT));
          return { ok: true };
        }
        return { ok: false, error: res.error };
      }
      const out = guestSellStock(ticker, shares, price);
      if (out.ok) {
        applyBundle(getGuestPortfolioBundle());
      }
      return out;
    },
    [user, applyBundle]
  );

  const depositVirtualFunds = useCallback(
    async (amount: number, method?: string): Promise<FundingResult> => {
      if (user) {
        const res = await remoteDepositVirtualFunds(amount, method);
        if (res.ok) {
          applyBundle(res.bundle);
          window.dispatchEvent(new Event(PORTFOLIO_EVENT));
          return { ok: true, newCashBalance: res.bundle.portfolio.cash };
        }
        return { ok: false, error: res.error };
      }
      const out = guestDeposit(amount, method);
      if (out.ok) {
        applyBundle(getGuestPortfolioBundle());
      }
      return out;
    },
    [user, applyBundle]
  );

  const withdrawVirtualFunds = useCallback(
    async (amount: number, method?: string): Promise<FundingResult> => {
      if (user) {
        const res = await remoteWithdrawVirtualFunds(amount, method);
        if (res.ok) {
          applyBundle(res.bundle);
          window.dispatchEvent(new Event(PORTFOLIO_EVENT));
          return { ok: true, newCashBalance: res.bundle.portfolio.cash };
        }
        return { ok: false, error: res.error };
      }
      const out = guestWithdraw(amount, method);
      if (out.ok) {
        applyBundle(getGuestPortfolioBundle());
      }
      return out;
    },
    [user, applyBundle]
  );

  const value = useMemo<PortfolioContextValue>(
    () => ({
      portfolio,
      transactions,
      accountActivity,
      portfolioReady: portfolioReady && !authLoading,
      isAuthenticated: Boolean(user),
      buyStock,
      sellStock,
      depositVirtualFunds,
      withdrawVirtualFunds,
      refreshPortfolio,
    }),
    [
      portfolio,
      transactions,
      accountActivity,
      portfolioReady,
      authLoading,
      user,
      buyStock,
      sellStock,
      depositVirtualFunds,
      withdrawVirtualFunds,
      refreshPortfolio,
    ]
  );

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext);
  if (!ctx) {
    throw new Error("usePortfolio must be used within PortfolioProvider");
  }
  return ctx;
}
