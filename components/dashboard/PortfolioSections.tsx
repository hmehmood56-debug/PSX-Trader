"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { ArrowUpRight, Clock3, Landmark, WalletCards } from "lucide-react";
import type { Transaction } from "@/lib/portfolioTypes";
import { formatPKRWithSymbol } from "@/lib/format";
import {
  type StockChartPoint,
  type StockDetailChartRange,
} from "@/app/stock/[ticker]/StockPriceLwcChart";
import { DashboardPortfolioChart } from "@/components/dashboard/DashboardPortfolioChart";

type HoldingRow = {
  ticker: string;
  name: string;
  shares: number;
  avgBuyPrice: number;
  px: number;
  value: number;
  pnl: number;
  pnlPct: number;
};

type PerformancePoint = {
  date: string;
  value: number;
};

const COLORS = {
  orange: "#C45000",
  border: "#E8E8E8",
  text: "#1A1A1A",
  muted: "#6B6B6B",
  gain: "#007A4C",
  loss: "#C0392B",
} as const;

const TIMEFRAME_LABELS: readonly StockDetailChartRange[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;

function signedPkr(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${formatPKRWithSymbol(n, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function sectionLabelStyle(): CSSProperties {
  return {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: COLORS.muted,
    fontWeight: 600,
  };
}

export function PortfolioSections({
  rows,
  txs,
  cash,
  portfolioValue,
  todayPnL,
  unrealizedPnl,
  performancePoints,
  isGuest,
}: {
  rows: HoldingRow[];
  txs: Transaction[];
  cash: number;
  portfolioValue: number;
  todayPnL: number;
  unrealizedPnl: number;
  performancePoints: PerformancePoint[];
  isGuest: boolean;
}) {
  const [timeframe, setTimeframe] = useState<StockDetailChartRange>("1M");
  const firstPoint = performancePoints[0];
  const latestPoint = performancePoints[performancePoints.length - 1];
  const periodDelta = (latestPoint?.value ?? portfolioValue) - (firstPoint?.value ?? portfolioValue);
  const trendColor = periodDelta >= 0 ? COLORS.gain : COLORS.loss;
  const dayColor = todayPnL >= 0 ? COLORS.gain : COLORS.loss;
  const investedValue = rows.reduce((sum, row) => sum + row.value, 0);
  const investedCost = rows.reduce((sum, row) => sum + row.shares * row.avgBuyPrice, 0);
  const unrealizedPct = investedCost > 0 ? (unrealizedPnl / investedCost) * 100 : 0;

  const chartSeries = useMemo<StockChartPoint[]>(() => {
    if (performancePoints.length === 0) {
      return [{ date: new Date().toISOString(), price: portfolioValue, volume: 0 }];
    }
    return performancePoints.map((point) => ({
      date: point.date,
      price: point.value,
      volume: 0,
    }));
  }, [performancePoints, portfolioValue]);

  const filteredChartSeries = useMemo(() => {
    if (chartSeries.length <= 1) return chartSeries;
    const sorted = [...chartSeries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const now = Date.now();
    const msByRange: Record<Exclude<StockDetailChartRange, "ALL">, number> = {
      "1D": 24 * 60 * 60 * 1000,
      "1W": 7 * 24 * 60 * 60 * 1000,
      "1M": 30 * 24 * 60 * 60 * 1000,
      "3M": 90 * 24 * 60 * 60 * 1000,
      "1Y": 365 * 24 * 60 * 60 * 1000,
    };
    const start = timeframe === "ALL" ? new Date(sorted[0].date).getTime() : now - msByRange[timeframe];
    const end = now;
    if (!Number.isFinite(start) || end <= start) return sorted.slice(-2);

    const targetPointsByRange: Record<StockDetailChartRange, number> = {
      "1D": 48,
      "1W": 44,
      "1M": 40,
      "3M": 38,
      "1Y": 34,
      "ALL": 36,
    };
    const target = targetPointsByRange[timeframe];
    const anchors = sorted.map((point) => ({ t: new Date(point.date).getTime(), p: point.price }));

    const interpolate = (t: number) => {
      if (t <= anchors[0].t) return anchors[0].p;
      if (t >= anchors[anchors.length - 1].t) return anchors[anchors.length - 1].p;
      for (let i = 1; i < anchors.length; i++) {
        const prev = anchors[i - 1];
        const next = anchors[i];
        if (t <= next.t) {
          const span = Math.max(1, next.t - prev.t);
          const ratio = (t - prev.t) / span;
          return prev.p + (next.p - prev.p) * ratio;
        }
      }
      return anchors[anchors.length - 1].p;
    };

    const generated = Array.from({ length: target }, (_, idx) => {
      const ratio = target <= 1 ? 1 : idx / (target - 1);
      const t = start + (end - start) * ratio;
      return { date: new Date(t).toISOString(), price: interpolate(t), volume: 0 };
    });

    const smoothed = generated.map((point, idx) => {
      const prev = generated[idx - 1]?.price ?? point.price;
      const next = generated[idx + 1]?.price ?? point.price;
      return { ...point, price: (prev + point.price * 2 + next) / 4 };
    });
    smoothed[0] = { ...smoothed[0], price: generated[0].price };
    smoothed[smoothed.length - 1] = {
      ...smoothed[smoothed.length - 1],
      price: generated[generated.length - 1].price,
    };
    return smoothed;
  }, [chartSeries, timeframe]);

  const recentTxs = useMemo(() => {
    return [...txs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);
  }, [txs]);

  return (
    <>
      <section className="perch-dashboard-hero">
        <div className="perch-dashboard-hero__masthead">
          <div />
          {isGuest ? (
            <Link href="/signup" className="perch-dashboard-hero__cta">
              Create account
            </Link>
          ) : null}
        </div>
        <div className="perch-dashboard-hero__top">
          <div className="perch-dashboard-hero__value-block">
            <span className="perch-dashboard-hero__accent" aria-hidden />
            <div className="perch-dashboard-hero__value">{formatPKRWithSymbol(portfolioValue)}</div>
            <div className="perch-dashboard-hero__day" style={{ color: dayColor }}>
              <span className="perch-dashboard-hero__day-num">
                Today {signedPkr(todayPnL)} ({todayPnL >= 0 ? "+" : ""}
                {portfolioValue > 0 ? ((todayPnL / portfolioValue) * 100).toFixed(2) : "0.00"}%)
              </span>
            </div>
          </div>

          <div className="perch-dashboard-hero__metrics">
            <div className="perch-dashboard-hero__metric">
              <Landmark className="perch-dashboard-hero__metric-icon" />
              <span className="perch-dashboard-hero__metric-label">Buying power</span>
              <span className="perch-dashboard-hero__metric-value">{formatPKRWithSymbol(cash)}</span>
            </div>
            <div className="perch-dashboard-hero__metric">
              <ArrowUpRight className="perch-dashboard-hero__metric-icon" />
              <span className="perch-dashboard-hero__metric-label">Unrealized P&amp;L</span>
              <span
                className="perch-dashboard-hero__metric-value"
                style={{ color: unrealizedPnl >= 0 ? COLORS.gain : COLORS.loss }}
              >
                {signedPkr(unrealizedPnl)} ({unrealizedPnl >= 0 ? "+" : ""}
                {unrealizedPct.toFixed(2)}%)
              </span>
            </div>
            <div className="perch-dashboard-hero__metric">
              <WalletCards className="perch-dashboard-hero__metric-icon" />
              <span className="perch-dashboard-hero__metric-label">Invested value</span>
              <span className="perch-dashboard-hero__metric-value">{formatPKRWithSymbol(investedValue)}</span>
            </div>
          </div>
        </div>

        <div className="perch-dashboard-chart-toolbar">
          <div className="perch-dashboard-chart-head" />
          <div className="perch-dashboard-hero__tf">
            {TIMEFRAME_LABELS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setTimeframe(label)}
                className="perch-dashboard-tf-btn"
                data-active={timeframe === label ? "true" : "false"}
                style={{
                  borderColor: timeframe === label ? COLORS.orange : COLORS.border,
                  color: timeframe === label ? COLORS.orange : COLORS.muted,
                  background: timeframe === label ? "rgba(196, 80, 0, 0.07)" : "transparent",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="perch-dashboard-chart-wrap">
          <DashboardPortfolioChart
            data={filteredChartSeries}
            range={timeframe}
            lineColor="#8B4510"
            lineColorFaint="rgba(139, 69, 16, 0.09)"
          />
        </div>
        {rows.length === 0 ? (
          <div className="perch-dashboard-empty-callout">
            <p>Build your first position to start your portfolio curve.</p>
            <div className="perch-dashboard-empty-callout__actions">
              <Link href="/markets/psx">Explore markets</Link>
              <Link href="/stocks">Browse stocks</Link>
            </div>
          </div>
        ) : null}
      </section>

      <div className="perch-dashboard-main-grid">
        <section className="perch-dashboard-table-shell">
          <div className="perch-dashboard-table-shell__label">
            <div style={sectionLabelStyle()}>Holdings</div>
          </div>
          {rows.length === 0 ? (
            <div className="perch-dashboard-personal-empty">
              <p>No holdings yet. Start with one position to track your portfolio performance.</p>
              <Link href="/markets/psx">Find your first trade</Link>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="perch-dashboard-data-table">
                <thead>
                  <tr>
                    {["Stock", "Shares", "Avg buy", "Last", "Value", "P&L"].map((h) => (
                      <th
                        key={h}
                        className={
                          h === "Stock" ? "perch-dashboard-data-table__left" : "perch-dashboard-data-table__right"
                        }
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const up = r.pnl >= 0;
                    return (
                      <tr key={r.ticker}>
                        <td className="perch-dashboard-data-table__td perch-dashboard-data-table__left">
                          <div style={{ color: COLORS.text, fontWeight: 700, letterSpacing: "0.02em" }}>{r.ticker}</div>
                          <div className="perch-dashboard-data-table__sub">{r.name}</div>
                        </td>
                        <td className="perch-dashboard-data-table__td perch-dashboard-data-table__right perch-dashboard-data-table__num">
                          {r.shares}
                        </td>
                        <td className="perch-dashboard-data-table__td perch-dashboard-data-table__right perch-dashboard-data-table__num">
                          {formatPKRWithSymbol(r.avgBuyPrice)}
                        </td>
                        <td className="perch-dashboard-data-table__td perch-dashboard-data-table__right perch-dashboard-data-table__num">
                          {formatPKRWithSymbol(r.px)}
                        </td>
                        <td className="perch-dashboard-data-table__td perch-dashboard-data-table__right perch-dashboard-data-table__num">
                          {formatPKRWithSymbol(r.value)}
                        </td>
                        <td
                          className="perch-dashboard-data-table__td perch-dashboard-data-table__right perch-dashboard-data-table__num"
                          style={{ color: up ? COLORS.gain : COLORS.loss, fontWeight: 650 }}
                        >
                          {up ? "+" : ""}
                          {formatPKRWithSymbol(r.pnl)} ({up ? "+" : ""}
                          {r.pnlPct.toFixed(2)}%)
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="perch-dashboard-table-shell">
          <div className="perch-dashboard-table-shell__label">
            <div style={sectionLabelStyle()}>Recent activity</div>
          </div>
          {recentTxs.length === 0 ? (
            <div className="perch-dashboard-personal-empty">
              <p>No trades yet. Your recent buys and sells will appear here once you start.</p>
              <Link href="/stocks">Start practice trading</Link>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="perch-dashboard-data-table perch-dashboard-data-table--txn">
                <thead>
                  <tr>
                    {["Time", "Side", "Ticker", "Shares", "Price", "Total"].map((h) => (
                      <th
                        key={h}
                        className={
                          h === "Time" || h === "Side" || h === "Ticker"
                            ? "perch-dashboard-data-table__left"
                            : "perch-dashboard-data-table__right"
                        }
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentTxs.map((t) => (
                    <tr key={t.id}>
                      <td className="perch-dashboard-data-table__td perch-dashboard-data-table__left perch-dashboard-data-table__time">
                        {new Date(t.timestamp).toLocaleString("en-PK")}
                      </td>
                      <td className="perch-dashboard-data-table__td perch-dashboard-data-table__left">
                        <span
                          className={
                            t.type === "BUY"
                              ? "perch-dashboard-txn-badge perch-dashboard-txn-badge--buy"
                              : "perch-dashboard-txn-badge perch-dashboard-txn-badge--sell"
                          }
                        >
                          {t.type}
                        </span>
                      </td>
                      <td className="perch-dashboard-data-table__td perch-dashboard-data-table__left" style={{ fontWeight: 700 }}>
                        {t.ticker}
                      </td>
                      <td className="perch-dashboard-data-table__td perch-dashboard-data-table__right perch-dashboard-data-table__num">
                        {t.shares}
                      </td>
                      <td className="perch-dashboard-data-table__td perch-dashboard-data-table__right perch-dashboard-data-table__num">
                        {formatPKRWithSymbol(t.price)}
                      </td>
                      <td className="perch-dashboard-data-table__td perch-dashboard-data-table__right perch-dashboard-data-table__num">
                        {formatPKRWithSymbol(t.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="perch-dashboard-table-block">
        <div className="perch-dashboard-table-shell__label perch-dashboard-table-shell__label--plain">
          <Clock3 className="perch-dashboard-inline-icon" />
          <div style={sectionLabelStyle()}>Next step</div>
        </div>
        <p className="perch-dashboard-activity-note">
          Keep your portfolio current by reviewing holdings and executing trades from stock detail pages.
        </p>
      </section>
    </>
  );
}
