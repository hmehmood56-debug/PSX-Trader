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

function DashboardSignupWall() {
  const previewBars = [34, 46, 40, 54, 50, 60, 56, 64, 58, 70, 66, 74];
  const fauxHoldings = [
    { ticker: "HBL", label: "Habib Bank", value: "Rs •••", day: "—" },
    { ticker: "OGDC", label: "Oil & Gas Dev.", value: "Rs •••", day: "—" },
    { ticker: "UBL", label: "United Bank", value: "Rs •••", day: "—" },
  ];
  const labelStyle = {
    fontSize: "0.6875rem",
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
    fontWeight: 600,
    color: COLORS.muted,
  };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh" }}>
      <div className="perch-shell perch-shell-wide perch-psx-shell">
        <div className="perch-dashboard-brand-line">
          <PerchWordmark compact />
        </div>

        <div
          style={{
            display: "grid",
            gap: "clamp(1rem, 2.5vw, 1.35rem)",
            alignItems: "stretch",
            gridTemplateColumns: "minmax(0, 1fr)",
            marginTop: "clamp(0.75rem, 2vw, 1.25rem)",
            marginBottom: "2rem",
          }}
        >
          <style>{`
            @media (min-width: 900px) {
              .dashboard-wall-grid {
                grid-template-columns: minmax(0, 1fr) minmax(300px, 400px) !important;
                gap: clamp(1.25rem, 2.5vw, 1.75rem) !important;
                align-items: start;
              }
            }
          `}</style>
          <div
            className="dashboard-wall-grid"
            style={{
              display: "grid",
              gap: "clamp(1.35rem, 3vw, 1.85rem)",
              gridTemplateColumns: "minmax(0, 1fr)",
            }}
          >
            <div style={{ maxWidth: 540 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(1.65rem, 3vw, 2.125rem)",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: COLORS.text,
                  lineHeight: 1.18,
                }}
              >
                Save your <span style={{ color: COLORS.orange }}>portfolio</span>.
                <br />
                Pick up where you left off.
              </h1>
              <p
                style={{
                  margin: "1.1rem 0 0",
                  fontSize: "1rem",
                  lineHeight: 1.58,
                  color: COLORS.muted,
                  maxWidth: 42 * 16,
                }}
              >
                Create an account to keep your practice trades, track your performance, and get notified when real trading
                access opens.
              </p>
              <p
                style={{
                  margin: "1.15rem 0 0",
                  fontSize: "1.0625rem",
                  lineHeight: 1.5,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  color: COLORS.text,
                  maxWidth: 42 * 16,
                }}
              >
                Track your trades, watch your performance, and get priority access to real trading.
              </p>

              <div
                style={{
                  marginTop: "1.85rem",
                  paddingTop: "1.15rem",
                  borderTop: `1px solid ${COLORS.border}`,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.8125rem",
                    lineHeight: 1.45,
                    color: COLORS.muted,
                    letterSpacing: "0.01em",
                  }}
                >
                  Your progress isn&apos;t saved yet.
                </p>
                <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                  <Link
                    href="/signup?from=dashboard"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                      width: "fit-content",
                      maxWidth: "100%",
                      padding: "0.8rem 1.35rem",
                      borderRadius: 10,
                      background: COLORS.orange,
                      color: "#fff",
                      fontWeight: 600,
                      fontSize: "0.9375rem",
                      textDecoration: "none",
                      boxShadow: "0 1px 0 rgba(0,0,0,0.08)",
                    }}
                  >
                    Create account to save your progress →
                  </Link>
                  <Link
                    href="/signin?from=dashboard"
                    style={{
                      fontSize: "0.9375rem",
                      color: COLORS.muted,
                      textDecoration: "none",
                      width: "fit-content",
                    }}
                  >
                    Already have an account? <span style={{ color: COLORS.text, textDecoration: "underline" }}>Sign in</span>
                  </Link>
                </div>
              </div>
            </div>

            <div
              aria-hidden
              style={{
                position: "relative",
                borderRadius: 16,
                border: `1px solid ${COLORS.border}`,
                background: `linear-gradient(152deg, ${COLORS.bgSecondary} 0%, ${COLORS.bg} 48%, #FDFCFB 100%)`,
                padding: "1.35rem 1.35rem 1.3rem",
                boxShadow: "0 16px 48px rgba(0,0,0,0.055), 0 1px 0 rgba(255,255,255,0.9) inset",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(95% 70% at 100% 0%, rgba(196, 80, 0, 0.08), transparent 56%), linear-gradient(160deg, rgba(196, 80, 0, 0.03), transparent 34%)",
                  pointerEvents: "none",
                }}
              />
              <div style={{ position: "relative", display: "grid", gap: "1.35rem" }}>
                <div>
                  <div style={labelStyle}>Portfolio Value</div>
                  <div
                    style={{
                      marginTop: "0.35rem",
                      fontSize: "clamp(1.5rem, 2.4vw, 1.85rem)",
                      fontWeight: 700,
                      letterSpacing: "-0.03em",
                      color: COLORS.text,
                      userSelect: "none",
                      opacity: 0.88,
                    }}
                  >
                    Rs <span style={{ color: COLORS.muted, opacity: 0.92 }}>••••••</span>
                  </div>
                </div>

                <div>
                  <div style={{ ...labelStyle, marginBottom: "0.5rem" }}>Performance</div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 4,
                      height: 72,
                      padding: "0.35rem 0.15rem 0",
                      borderRadius: 10,
                      background: `linear-gradient(180deg, rgba(247,247,247,0.9) 0%, ${COLORS.bg} 100%)`,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    {previewBars.map((h, i) => {
                      const isLast = i === previewBars.length - 1;
                      return (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            minWidth: 3,
                            maxWidth: 8,
                            height: `${h}%`,
                            borderRadius: 3,
                            background: isLast
                              ? `linear-gradient(180deg, ${COLORS.orange} 0%, #a84300 100%)`
                              : `linear-gradient(180deg, #D9D9D9 0%, ${COLORS.border} 100%)`,
                            opacity: isLast ? 0.92 : 0.78,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div style={{ ...labelStyle, marginBottom: "0.55rem" }}>Holdings</div>
                  <div
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${COLORS.border}`,
                      overflow: "hidden",
                      background: COLORS.bg,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto",
                        gap: "0.5rem",
                        padding: "0.45rem 0.65rem",
                        fontSize: "0.625rem",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        fontWeight: 600,
                        color: COLORS.muted,
                        background: COLORS.bgSecondary,
                        borderBottom: `1px solid ${COLORS.border}`,
                      }}
                    >
                      <span>Name</span>
                      <span style={{ textAlign: "right" }}>Value</span>
                      <span style={{ textAlign: "right" }}>Day</span>
                    </div>
                    {fauxHoldings.map((row, idx) => (
                      <div
                        key={row.ticker}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto auto",
                          gap: "0.5rem",
                          alignItems: "center",
                          padding: "0.65rem 0.65rem",
                          fontSize: "0.8125rem",
                          borderTop: idx === 0 ? "none" : `1px solid ${COLORS.border}`,
                          background: idx % 2 === 0 ? "rgba(247,247,247,0.35)" : COLORS.bg,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 650, color: COLORS.orange, letterSpacing: "-0.01em" }}>{row.ticker}</div>
                          <div style={{ fontSize: "0.7rem", color: COLORS.muted, marginTop: 2, lineHeight: 1.3 }}>
                            {row.label}
                          </div>
                        </div>
                        <span style={{ color: COLORS.muted, fontWeight: 500, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {row.value}
                        </span>
                        <span
                          style={{
                            color: COLORS.muted,
                            fontWeight: 500,
                            textAlign: "right",
                            fontSize: "0.75rem",
                            opacity: 0.85,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {row.day}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="perch-dashboard-footer">© 2026 Perch Capital. All rights reserved.</footer>
      </div>
    </div>
  );
}

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

  if (!user) return <DashboardSignupWall />;

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
