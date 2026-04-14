"use client";

import Link from "next/link";
import { useLivePrices } from "@/lib/priceSimulator";
import { getStockByTicker } from "@/lib/mockData";
import {
  getTransactionHistory,
  type Transaction,
} from "@/lib/portfolioStore";
import { formatPKRWithSymbol } from "@/lib/format";
import { usePortfolioState } from "@/hooks/usePortfolioState";
import { useMemo, useState, useEffect, type CSSProperties } from "react";
import { PortfolioSections } from "@/components/dashboard/PortfolioSections";

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
    background: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
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
  const portfolio = usePortfolioState();
  const { getQuote, getStocksWithLive } = useLivePrices();
  const [txs, setTxs] = useState<Transaction[]>([]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setTxs(getTransactionHistory());
    const onUp = () => setTxs(getTransactionHistory());
    window.addEventListener("psx-portfolio-updated", onUp);
    return () => window.removeEventListener("psx-portfolio-updated", onUp);
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

  const totalReturnPct = ((portfolioValue - 1_000_000) / 1_000_000) * 100;

  const stocks = getStocksWithLive();
  const gainers = [...stocks]
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 3);
  const losers = [...stocks]
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 3);

  const rows = useMemo(() => {
    return portfolio.holdings.map((h) => {
      const q = getQuote(h.ticker);
      const px = q?.price ?? getStockByTicker(h.ticker)?.price ?? 0;
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

  if (!mounted) return null;

  return (
    <div style={{ background: COLORS.bg }}>
      <div className="perch-shell perch-shell-wide perch-psx-shell">
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
            label="Today's P&L"
            value={signedPkr(todayPnL)}
            valueColor={todayPnL >= 0 ? COLORS.gain : COLORS.loss}
          />
          <StatCard
            label="Total Return"
            value={`${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(
              2
            )}%`}
            valueColor={totalReturnPct >= 0 ? COLORS.gain : COLORS.loss}
          />
        </div>

        <div className="perch-dashboard-two-col">
          <div style={cardStyle()}>
            <div style={labelStyle()}>Top Gainers</div>
            <div style={{ marginTop: 12 }}>
              {gainers.map((s, idx) => (
                <div
                  key={s.ticker}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 0",
                    borderTop: idx === 0 ? "none" : `1px solid ${COLORS.border}`,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <Link
                      href={`/stock/${s.ticker}`}
                      style={{
                        color: COLORS.orange,
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      {s.ticker}
                    </Link>
                    <div
                      style={{
                        color: COLORS.muted,
                        fontSize: 13,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "min(360px, 100%)",
                      }}
                    >
                      {s.name}
                    </div>
                  </div>
                  <div
                    style={{
                      fontWeight: 700,
                      color: COLORS.gain,
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    +{s.changePercent.toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle()}>
            <div style={labelStyle()}>Top Losers</div>
            <div style={{ marginTop: 12 }}>
              {losers.map((s, idx) => (
                <div
                  key={s.ticker}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 0",
                    borderTop: idx === 0 ? "none" : `1px solid ${COLORS.border}`,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <Link
                      href={`/stock/${s.ticker}`}
                      style={{
                        color: COLORS.orange,
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      {s.ticker}
                    </Link>
                    <div
                      style={{
                        color: COLORS.muted,
                        fontSize: 13,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "min(360px, 100%)",
                      }}
                    >
                      {s.name}
                    </div>
                  </div>
                  <div
                    style={{
                      fontWeight: 700,
                      color: COLORS.loss,
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.changePercent.toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
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
          marginTop: 10,
          fontSize: 28,
          fontWeight: 700,
          color: valueColor ?? COLORS.text,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
