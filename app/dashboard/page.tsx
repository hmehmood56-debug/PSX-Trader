"use client";

import Link from "next/link";
import { useLivePrices } from "@/lib/priceSimulator";
import { getStockByTicker } from "@/lib/mockData";
import { usePortfolio } from "@/hooks/usePortfolioState";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMemo, useState, useEffect } from "react";
import { PortfolioSections } from "@/components/dashboard/PortfolioSections";
import { PerchWordmark } from "@/components/PerchWordmark";
import { logAnalyticsEvent } from "@/lib/analytics/client";

const COLORS = {
  orange: "#C45000",
  bg: "#FFFFFF",
  bgSecondary: "#F7F7F7",
  border: "#E8E8E8",
  text: "#1A1A1A",
  muted: "#6B6B6B",
  gain: "#007A4C",
  loss: "#C0392B",
} as const;

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const { portfolio, transactions: txs, portfolioReady } = usePortfolio();
  const { user, loading: authLoading } = useAuth();
  const { getQuote } = useLivePrices();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    void logAnalyticsEvent("dashboard_viewed", { route: "/dashboard" });
  }, []);

  const holdingsValue = useMemo(() => {
    let v = 0;
    for (const h of portfolio.holdings) {
      const q = getQuote(h.ticker);
      const px = q?.price;
      if (px != null) v += h.shares * px;
    }
    return v;
  }, [portfolio.holdings, getQuote]);

  const portfolioValue = portfolio.cash + holdingsValue;

  const todayPnL = useMemo(() => {
    let pnl = 0;
    for (const h of portfolio.holdings) {
      const q = getQuote(h.ticker);
      if (q) pnl += h.shares * q.change;
    }
    return pnl;
  }, [portfolio.holdings, getQuote]);

  const rows = useMemo(() => {
    return portfolio.holdings.map((h) => {
      const q = getQuote(h.ticker);
      const px = q?.price ?? h.avgBuyPrice;
      const value = h.shares * px;
      const cost = h.shares * h.avgBuyPrice;
      const pnl = value - cost;
      const pnlPct = cost !== 0 ? (pnl / cost) * 100 : 0;
      const name = getStockByTicker(h.ticker)?.name ?? h.ticker;
      return { ...h, name, px, value, pnl, pnlPct };
    });
  }, [portfolio.holdings, getQuote]);

  const unrealizedPnl = rows.reduce((sum, r) => sum + r.pnl, 0);

  const performancePoints = useMemo(() => {
    const nowIso = new Date().toISOString();
    const currentMarks = new Map<string, number>();
    for (const row of rows) currentMarks.set(row.ticker, row.px);

    const sortedTxs = [...txs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const netBuyCost = sortedTxs.reduce((sum, tx) => {
      return tx.type === "BUY" ? sum + tx.total : sum - tx.total;
    }, 0);
    const estimatedStartingCash = Math.max(0, portfolio.cash + netBuyCost);

    let runningCash = estimatedStartingCash;
    const holdings = new Map<string, number>();
    const points: { date: string; value: number }[] = [];

    for (const tx of sortedTxs) {
      const priorShares = holdings.get(tx.ticker) ?? 0;
      if (tx.type === "BUY") {
        holdings.set(tx.ticker, priorShares + tx.shares);
        runningCash -= tx.total;
      } else {
        const soldShares = Math.min(priorShares, tx.shares);
        holdings.set(tx.ticker, Math.max(0, priorShares - soldShares));
        runningCash += tx.total;
      }
      const markedHoldingsValue = Array.from(holdings.entries()).reduce((sum, [ticker, shares]) => {
        if (shares <= 0) return sum;
        return sum + shares * (currentMarks.get(ticker) ?? tx.price);
      }, 0);
      points.push({
        date: tx.timestamp,
        value: Math.max(0, runningCash + markedHoldingsValue),
      });
    }

    points.push({ date: nowIso, value: Math.max(0, portfolioValue) });
    if (points.length === 1) {
      const backfill = new Date();
      backfill.setDate(backfill.getDate() - 7);
      return [
        { date: backfill.toISOString(), value: Math.max(0, portfolioValue) },
        points[0],
      ];
    }
    return points;
  }, [txs, rows, portfolio.cash, portfolioValue]);

  if (!mounted || !portfolioReady || authLoading) return null;

  return (
    <div style={{ background: COLORS.bg }}>
      <div className="perch-shell perch-shell-wide perch-psx-shell">
        <div className="perch-dashboard-brand-line">
          <PerchWordmark compact />
        </div>
        <PortfolioSections
          rows={rows}
          txs={txs}
          cash={portfolio.cash}
          portfolioValue={portfolioValue}
          todayPnL={todayPnL}
          unrealizedPnl={unrealizedPnl}
          performancePoints={performancePoints}
          isGuest={!user}
        />
        <footer className="perch-dashboard-footer">© 2026 Perch Capital. All rights reserved.</footer>
      </div>
    </div>
  );
}
