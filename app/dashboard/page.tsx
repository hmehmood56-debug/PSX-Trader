"use client";

import { useLivePrices } from "@/lib/priceSimulator";
import { getStockByTicker } from "@/lib/mockData";
import { formatPKRWithSymbol } from "@/lib/format";
import { usePortfolio } from "@/hooks/usePortfolioState";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMemo, useState, useEffect, type CSSProperties } from "react";
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

function signedPkr(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${formatPKRWithSymbol(n, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function cardStyle(): CSSProperties {
  return {
    background: "linear-gradient(180deg, #FFFFFF 0%, #FCFCFC 100%)",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 10px 26px rgba(26, 26, 26, 0.05)",
    minHeight: 132,
  };
}

function labelStyle(): CSSProperties {
  return {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: COLORS.muted,
    fontWeight: 600,
  };
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const { portfolio, transactions: txs, portfolioReady } = usePortfolio();
  const { user } = useAuth();
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
    "Investor";

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

  if (!mounted || !portfolioReady) return null;

  return (
    <div style={{ background: COLORS.bg }}>
      <div className="perch-shell perch-shell-wide perch-psx-shell">
        <section className="dashboard-header">
          <div>
            <div style={{ marginBottom: 8 }}>
              <PerchWordmark compact />
            </div>
            <h1>Welcome back, {displayName}</h1>
            <p>Here&apos;s your portfolio snapshot today</p>
          </div>
        </section>
        <div className="perch-dashboard-stats">
          <StatCard
            label="Portfolio Value"
            value={formatPKRWithSymbol(portfolioValue)}
          />
          <StatCard
            label="Cash Available"
            value={formatPKRWithSymbol(portfolio.cash)}
          />
          <StatCard
            label="Portfolio Health"
            value={signedPkr(todayPnL)}
            valueColor={todayPnL >= 0 ? COLORS.gain : COLORS.loss}
          />
          <StatCard
            label="Market Breadth"
            value={`${Math.round(market.marketBreadth * 100)}%`}
            valueColor={market.marketBreadth >= 0.5 ? COLORS.gain : COLORS.loss}
          />
        </div>

        <PortfolioSections
          rows={rows}
          txs={txs}
          cash={portfolio.cash}
          holdingsValue={holdingsValue}
          performancePoints={performancePoints}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div style={cardStyle()}>
      <div style={labelStyle()}>{label}</div>
      <div
        style={{
          marginTop: 14,
          fontSize: "clamp(28px, 4vw, 34px)",
          fontWeight: 760,
          color: valueColor ?? COLORS.text,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.06,
        }}
      >
        {value}
      </div>
    </div>
  );
}
