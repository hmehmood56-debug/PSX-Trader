"use client";

import Link from "next/link";
import { useLivePrices } from "@/lib/priceSimulator";
import {
  getTransactionHistory,
  type Transaction,
} from "@/lib/portfolioStore";
import { formatPKRWithSymbol } from "@/lib/format";
import { usePortfolioState } from "@/hooks/usePortfolioState";
import { useMemo, useState, useEffect, type CSSProperties } from "react";

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
  const [recent, setRecent] = useState<Transaction[]>([]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setRecent(getTransactionHistory().slice(0, 5));
    const onUp = () => setRecent(getTransactionHistory().slice(0, 5));
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

  const totalReturnPct =
    ((portfolioValue - 1_000_000) / 1_000_000) * 100;

  const stocks = getStocksWithLive();
  const gainers = [...stocks]
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 3);
  const losers = [...stocks]
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 3);

  if (!mounted) return null;

  return (
    <div style={{ background: COLORS.bg }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 32 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
          }}
        >
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginTop: 16,
          }}
        >
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
                        maxWidth: 360,
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
                        maxWidth: 360,
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

        <div style={{ marginTop: 16, ...cardStyle() }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 12,
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            <div style={labelStyle()}>Recent Transactions</div>
            <Link
              href="/portfolio"
              style={{
                color: COLORS.orange,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              View all
            </Link>
          </div>

          {recent.length === 0 ? (
            <div style={{ marginTop: 12, color: COLORS.muted, fontSize: 14 }}>
              No trades yet. Browse{" "}
              <Link
                href="/stocks"
                style={{
                  color: COLORS.orange,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                stocks
              </Link>{" "}
              to place your first order.
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              {recent.map((tx, idx) => (
                <div
                  key={tx.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 0",
                    borderTop: idx === 0 ? "none" : `1px solid ${COLORS.border}`,
                    fontSize: 14,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: tx.type === "BUY" ? COLORS.gain : COLORS.loss,
                      minWidth: 56,
                    }}
                  >
                    {tx.type}
                  </div>
                  <div
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontWeight: 700,
                      color: COLORS.text,
                      minWidth: 64,
                    }}
                  >
                    {tx.ticker}
                  </div>
                  <div style={{ color: COLORS.muted, flex: 1 }}>
                    {tx.shares} sh @ {formatPKRWithSymbol(tx.price)}
                  </div>
                  <div
                    style={{
                      fontWeight: 700,
                      color: COLORS.text,
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatPKRWithSymbol(tx.total)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
