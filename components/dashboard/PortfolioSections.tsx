"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Transaction } from "@/lib/portfolioTypes";
import { formatPKRWithSymbol } from "@/lib/format";

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
  label: string;
  pnl: number;
};

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

/** Muted bar fills for allocation (non–top holding) */
const ALLOCATION_MUTED = ["#94A3AF", "#A1A1AA", "#B4B4B8", "#BFBFBF", "#C4C4C4", "#C9C9C9", "#CECECE"] as const;

const TIMEFRAME_LABELS = ["1D", "1W", "1M", "1Y", "5Y", "ALL"] as const;
type Timeframe = (typeof TIMEFRAME_LABELS)[number];

function pointsForTimeframe(timeframe: Timeframe): number {
  switch (timeframe) {
    case "1D":
      return 12;
    case "1W":
      return 24;
    case "1M":
      return 40;
    case "1Y":
      return 80;
    case "5Y":
      return 120;
    case "ALL":
    default:
      return Number.MAX_SAFE_INTEGER;
  }
}

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
  holdingsValue,
  portfolioValue,
  todayPnL,
  unrealizedPnl,
  marketBreadth,
  performancePoints,
}: {
  rows: HoldingRow[];
  txs: Transaction[];
  cash: number;
  holdingsValue: number;
  portfolioValue: number;
  todayPnL: number;
  unrealizedPnl: number;
  marketBreadth: number;
  performancePoints: PerformancePoint[];
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const latestPnl = performancePoints[performancePoints.length - 1]?.pnl ?? 0;
  const trendColor = latestPnl >= 0 ? COLORS.gain : COLORS.loss;
  const dayColor = todayPnL >= 0 ? COLORS.gain : COLORS.loss;

  const filteredPerformancePoints = useMemo(() => {
    const count = pointsForTimeframe(timeframe);
    if (performancePoints.length <= count) return performancePoints;
    return performancePoints.slice(-count);
  }, [performancePoints, timeframe]);

  const totalInvested = Math.max(0, holdingsValue);
  const totalValue = Math.max(1, cash + totalInvested);
  const cashPct = (cash / totalValue) * 100;
  const investedPct = (totalInvested / totalValue) * 100;

  const allocationRows = useMemo(() => {
    const base = rows
      .map((row) => ({
        ticker: row.ticker,
        value: row.value,
        pct: totalInvested > 0 ? (row.value / totalInvested) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
    return base.slice(0, 8);
  }, [rows, totalInvested]);

  const lastPoint = filteredPerformancePoints[filteredPerformancePoints.length - 1];

  /** Render-only path: insert midpoints with small wobble so segments are not ruler-straight */
  const chartSeriesPoints = useMemo(() => {
    const pts = filteredPerformancePoints;
    if (pts.length <= 1) return pts;
    const out: PerformancePoint[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const leg = Math.abs(curr.pnl - prev.pnl);
      const scale = Math.max(leg, Math.abs(latestPnl) * 0.025, 6);
      const midLinear = (prev.pnl + curr.pnl) / 2;
      const wobble = scale * 0.055 * Math.sin(i * 1.91 + prev.pnl * 1e-7);
      out.push({ label: `·${i}`, pnl: midLinear + wobble });
      out.push(curr);
    }
    return out;
  }, [filteredPerformancePoints, latestPnl]);

  return (
    <>
      {/* Hero — flush to page; no card frame */}
      <section className="perch-dashboard-hero">
        <div className="perch-dashboard-hero__top">
          <div className="perch-dashboard-hero__value-block">
            <div className="perch-dashboard-hero__eyebrow">Portfolio</div>
            <div className="perch-dashboard-hero__value">{formatPKRWithSymbol(portfolioValue)}</div>
            <div className="perch-dashboard-hero__day" style={{ color: dayColor }}>
              <span className="perch-dashboard-hero__day-label">Day</span>{" "}
              <span className="perch-dashboard-hero__day-num">{signedPkr(todayPnL)}</span>
            </div>
            <div className="perch-dashboard-hero__secondary">Unrealized {signedPkr(unrealizedPnl)}</div>
          </div>
          <div className="perch-dashboard-hero__tf">
            {TIMEFRAME_LABELS.map((label) => {
              const active = timeframe === label;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setTimeframe(label)}
                  className="perch-dashboard-tf-btn"
                  data-active={active ? "true" : "false"}
                  style={{
                    borderColor: active ? COLORS.orange : COLORS.border,
                    color: active ? COLORS.orange : COLORS.muted,
                    background: active ? "rgba(196, 80, 0, 0.07)" : "transparent",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="perch-dashboard-chart-head">
          <span style={sectionLabelStyle()}>Cumulative P&amp;L</span>
        </div>
        <div className="perch-dashboard-chart-wrap">
          <div className="perch-dashboard-chart-live">
            <span className="perch-dashboard-chart-live__lbl">Last</span>
            <span className="perch-dashboard-chart-live__val" style={{ color: trendColor }}>
              {latestPnl >= 0 ? "+" : ""}
              {formatPKRWithSymbol(latestPnl)}
            </span>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartSeriesPoints} margin={{ top: 6, right: 4, left: 2, bottom: 0 }}>
              <CartesianGrid stroke="#E8E8E8" strokeDasharray="2 3" vertical={false} horizontal />
              <XAxis
                dataKey="label"
                tick={{ fill: "#6E6E6E", fontSize: 9 }}
                axisLine={{ stroke: "#D8D8D8" }}
                tickLine={false}
                tickMargin={4}
                minTickGap={36}
                interval="preserveStartEnd"
                tickFormatter={(v) => (typeof v === "string" && v.startsWith("·") ? "" : String(v))}
              />
              <YAxis
                width={54}
                tick={{ fill: "#6E6E6E", fontSize: 8 }}
                tickFormatter={(v) => `${Math.round(Number(v))}`}
                axisLine={false}
                tickLine={false}
                domain={["auto", "auto"]}
              />
              <Tooltip
                cursor={{ stroke: "#C8C8C8", strokeWidth: 1 }}
                formatter={(v: number) => [formatPKRWithSymbol(v), "P&L"]}
                labelFormatter={(label) =>
                  typeof label === "string" && label.startsWith("·") ? "" : String(label)
                }
                labelStyle={{ fontSize: 9, color: "#6E6E6E", marginBottom: 2 }}
                itemStyle={{ fontSize: 11, fontWeight: 600, padding: 0 }}
                contentStyle={{
                  padding: "4px 8px",
                  border: "1px solid #D0D0D0",
                  borderRadius: 2,
                  boxShadow: "none",
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey="pnl"
                stroke="none"
                fill={trendColor}
                fillOpacity={0.035}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="pnl"
                stroke={trendColor}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: trendColor }}
                isAnimationActive={false}
              />
              {lastPoint ? (
                <ReferenceDot
                  x={lastPoint.label}
                  y={lastPoint.pnl}
                  r={3.5}
                  fill={trendColor}
                  stroke="#fff"
                  strokeWidth={1.5}
                  ifOverflow="visible"
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="perch-dashboard-compact-metrics" role="group" aria-label="Account metrics">
        <div className="perch-dashboard-compact-metrics__inline">
          <span className="perch-dashboard-compact-metrics__k">Cash</span>
          <span className="perch-dashboard-compact-metrics__v">{formatPKRWithSymbol(cash)}</span>
        </div>
        <div className="perch-dashboard-compact-metrics__inline">
          <span className="perch-dashboard-compact-metrics__k">Inv</span>
          <span className="perch-dashboard-compact-metrics__v">{formatPKRWithSymbol(totalInvested)}</span>
        </div>
        <div className="perch-dashboard-compact-metrics__inline">
          <span className="perch-dashboard-compact-metrics__k">U. P&amp;L</span>
          <span className="perch-dashboard-compact-metrics__v" style={{ color: unrealizedPnl >= 0 ? COLORS.gain : COLORS.loss }}>
            {signedPkr(unrealizedPnl)}
          </span>
        </div>
        <div className="perch-dashboard-compact-metrics__inline">
          <span className="perch-dashboard-compact-metrics__k">Breadth</span>
          <span className="perch-dashboard-compact-metrics__v" style={{ color: marketBreadth >= 0.5 ? COLORS.gain : COLORS.loss }}>
            {`${Math.round(marketBreadth * 100)}%`}
          </span>
        </div>
      </div>

      <div className="perch-dashboard-main-grid">
        <div style={{ minWidth: 0 }}>
          <div className="perch-dashboard-table-shell">
            <div className="perch-dashboard-table-shell__label">
              <div style={sectionLabelStyle()}>Holdings</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="perch-dashboard-data-table">
                <thead>
                  <tr>
                    {["Stock", "Shares", "Avg buy", "Last", "Value", "P&L", "P&L %"].map((h) => (
                      <th
                        key={h}
                        className={h === "Stock" ? "perch-dashboard-data-table__left" : "perch-dashboard-data-table__right"}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="perch-dashboard-data-table__empty">
                        No open positions yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
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
                            {formatPKRWithSymbol(r.pnl)}
                          </td>
                          <td
                            className="perch-dashboard-data-table__td perch-dashboard-data-table__right perch-dashboard-data-table__num"
                            style={{ color: up ? COLORS.gain : COLORS.loss, fontWeight: 650 }}
                          >
                            {up ? "+" : ""}
                            {r.pnlPct.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="perch-dashboard-sidebar perch-dashboard-sidebar--flush">
          <div className="perch-dashboard-side-block">
            <div style={sectionLabelStyle()}>Allocation</div>
            {allocationRows.length === 0 ? (
              <div className="perch-dashboard-side-block__hint">Allocation appears once you hold shares.</div>
            ) : (
              <div className="perch-dashboard-alloc">
                {allocationRows.map((item, index) => (
                  <div
                    key={item.ticker}
                    className={
                      index === 0
                        ? "perch-dashboard-alloc__row perch-dashboard-alloc__row--lead"
                        : "perch-dashboard-alloc__row"
                    }
                  >
                    <span className="perch-dashboard-alloc__ticker">{item.ticker}</span>
                    <div className="perch-dashboard-alloc__track">
                      <div
                        className="perch-dashboard-alloc__fill"
                        style={{
                          width: `${Math.min(100, Math.max(0.5, item.pct))}%`,
                          background: index === 0 ? COLORS.orange : ALLOCATION_MUTED[(index - 1) % ALLOCATION_MUTED.length],
                        }}
                      />
                    </div>
                    <span className="perch-dashboard-alloc__pct">{item.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="perch-dashboard-side-block">
            <div style={sectionLabelStyle()}>Cash vs invested</div>
            <div className="perch-dashboard-cashbar-head">
              <span className="perch-dashboard-cashbar-head__tag">Cash</span>
              <span className="perch-dashboard-cashbar-head__tag perch-dashboard-cashbar-head__tag--inv">Invested</span>
            </div>
            <div className="perch-dashboard-cashbar" aria-hidden>
              <div className="perch-dashboard-cashbar__cash" style={{ width: `${cashPct}%` }} />
              <div className="perch-dashboard-cashbar__inv" style={{ width: `${investedPct}%` }} />
            </div>
            <div className="perch-dashboard-cashbar__legend">
              <span className="perch-dashboard-cashbar__line">
                {cashPct.toFixed(0)}% · {formatPKRWithSymbol(cash)}
              </span>
              <span className="perch-dashboard-cashbar__line">
                {investedPct.toFixed(0)}% · {formatPKRWithSymbol(totalInvested)}
              </span>
            </div>
          </div>
        </aside>
      </div>

      <section className="perch-dashboard-table-block">
        <div className="perch-dashboard-table-shell__label">
          <div style={sectionLabelStyle()}>Recent activity</div>
        </div>
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
              {txs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="perch-dashboard-data-table__empty">
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                txs.map((t) => (
                  <tr key={t.id}>
                    <td className="perch-dashboard-data-table__td perch-dashboard-data-table__left perch-dashboard-data-table__time">
                      {new Date(t.timestamp).toLocaleString("en-PK")}
                    </td>
                    <td className="perch-dashboard-data-table__td perch-dashboard-data-table__left">
                      <span
                        className={
                          t.type === "BUY" ? "perch-dashboard-txn-badge perch-dashboard-txn-badge--buy" : "perch-dashboard-txn-badge perch-dashboard-txn-badge--sell"
                        }
                      >
                        {t.type}
                      </span>
                    </td>
                    <td className="perch-dashboard-data-table__td perch-dashboard-data-table__left" style={{ fontWeight: 700 }}>
                      {t.ticker}
                    </td>
                    <td className="perch-dashboard-data-table__td perch-dashboard-data-table__right perch-dashboard-data-table__num">{t.shares}</td>
                    <td className="perch-dashboard-data-table__td perch-dashboard-data-table__right perch-dashboard-data-table__num">
                      {formatPKRWithSymbol(t.price)}
                    </td>
                    <td className="perch-dashboard-data-table__td perch-dashboard-data-table__right perch-dashboard-data-table__num">
                      {formatPKRWithSymbol(t.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
