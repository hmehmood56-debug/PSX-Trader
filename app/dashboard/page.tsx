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
  const { getQuote, getMarketSnapshot } = useLivePrices();

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

  const market = getMarketSnapshot();
  const displayName =
    (user?.user_metadata?.username as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Account";

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
    if (txs.length === 0) {
      return [
        { label: "Start", pnl: 0 },
        { label: "Now", pnl: unrealizedPnl },
      ];
    }

    const ascending = [...txs].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const book: Record<string, { shares: number; avg: number }> = {};
    let realized = 0;
    const points: { label: string; pnl: number }[] = [{ label: "Start", pnl: 0 }];

    for (const tx of ascending) {
      const key = tx.ticker;
      const pos = book[key] ?? { shares: 0, avg: 0 };
      if (tx.type === "BUY") {
        const totalShares = pos.shares + tx.shares;
        const nextAvg =
          totalShares === 0
            ? 0
            : (pos.avg * pos.shares + tx.price * tx.shares) / totalShares;
        book[key] = { shares: totalShares, avg: nextAvg };
      } else {
        const sold = Math.min(tx.shares, pos.shares);
        realized += (tx.price - pos.avg) * sold;
        const nextShares = Math.max(0, pos.shares - sold);
        book[key] = { shares: nextShares, avg: nextShares === 0 ? 0 : pos.avg };
      }

      points.push({
        label: new Date(tx.timestamp).toLocaleDateString("en-PK", {
          month: "short",
          day: "numeric",
        }),
        pnl: realized,
      });
    }

    const len = points.length;
    const smoothed = points.map((p, idx) => ({
      label: p.label,
      pnl: p.pnl + unrealizedPnl * (idx / Math.max(1, len - 1)),
    }));
    smoothed[smoothed.length - 1] = {
      label: "Now",
      pnl: realized + unrealizedPnl,
    };
    return smoothed;
  }, [txs, unrealizedPnl]);

  if (!mounted || !portfolioReady || authLoading) return null;

  return (
    <div style={{ background: COLORS.bg }}>
      <div className="perch-shell perch-shell-wide perch-psx-shell">
        <section className="dashboard-header dashboard-header--brokerage">
          <div>
            <div className="perch-dashboard-brand-line">
              <PerchWordmark compact />
            </div>
            {user ? (
              <>
                <h1>Welcome back, {displayName}</h1>
                <p>Here&apos;s your portfolio snapshot today</p>
              </>
            ) : (
              <>
                <p
                  style={{
                    display: "inline-block",
                    margin: "0 0 8px",
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: COLORS.muted,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 999,
                    background: COLORS.bgSecondary,
                  }}
                >
                  Preview mode
                </p>
                <h1>Practice portfolio</h1>
                <p>Simulation only. Numbers here are not a real brokerage account.</p>
              </>
            )}
          </div>
        </section>
        {!user ? (
          <div
            style={{
              marginBottom: 24,
              padding: "16px 18px",
              borderRadius: 14,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.bgSecondary,
            }}
          >
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: COLORS.text }}>
              Create an account to save your progress and get access to real trading features.
            </p>
            <Link
              href="/signup"
              style={{
                marginTop: 12,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 44,
                padding: "0 18px",
                borderRadius: 10,
                background: COLORS.orange,
                color: "#fff",
                fontSize: 15,
                fontWeight: 650,
                textDecoration: "none",
              }}
            >
              Create account
            </Link>
          </div>
        ) : null}
        <PortfolioSections
          rows={rows}
          txs={txs}
          cash={portfolio.cash}
          holdingsValue={holdingsValue}
          portfolioValue={portfolioValue}
          todayPnL={todayPnL}
          unrealizedPnl={unrealizedPnl}
          marketBreadth={market.marketBreadth}
          performancePoints={performancePoints}
        />
        <footer className="perch-dashboard-footer">© 2026 Perch Capital. All rights reserved.</footer>
      </div>
    </div>
  );
}
