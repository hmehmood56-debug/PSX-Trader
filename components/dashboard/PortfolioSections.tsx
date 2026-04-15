"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
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

const ALLOCATION_COLORS = ["#C45000", "#D46C30", "#E28957", "#EEA67F", "#F4BFA1", "#B85A1A"];
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

function cardStyle(): CSSProperties {
  return {
    background: "linear-gradient(180deg, #FFFFFF 0%, #FCFCFC 100%)",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 10px 26px rgba(26, 26, 26, 0.05)",
  };
}

function sectionLabelStyle(): CSSProperties {
  return {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: COLORS.muted,
    fontWeight: 600,
  };
}

export function PortfolioSections({
  rows,
  txs,
  cash,
  holdingsValue,
  performancePoints,
}: {
  rows: HoldingRow[];
  txs: Transaction[];
  cash: number;
  holdingsValue: number;
  performancePoints: PerformancePoint[];
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const latestPnl = performancePoints[performancePoints.length - 1]?.pnl ?? 0;
  const trendColor = latestPnl >= 0 ? COLORS.gain : COLORS.loss;

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

  return (
    <>
      <div style={{ marginTop: 16, ...cardStyle() }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
          <div>
            <div style={sectionLabelStyle()}>Portfolio performance</div>
            <div style={{ marginTop: 8, fontSize: 24, fontWeight: 720, color: trendColor }}>
              {latestPnl >= 0 ? "+" : ""}
              {formatPKRWithSymbol(latestPnl)}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {TIMEFRAME_LABELS.map((label) => {
              const active = timeframe === label;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setTimeframe(label)}
                  style={{
                    minHeight: 34,
                    borderRadius: 999,
                    border: active ? "1px solid #AF4300" : `1px solid ${COLORS.border}`,
                    background: active ? COLORS.orange : "#FFFFFF",
                    color: active ? "#FFFFFF" : COLORS.muted,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    padding: "0 12px",
                    cursor: "pointer",
                    transition: "all 170ms ease",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ marginTop: 14, width: "100%", height: 290 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredPerformancePoints} margin={{ top: 8, right: 8, left: 0, bottom: 6 }}>
              <defs>
                <linearGradient id="perchPnlFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={trendColor} stopOpacity={0.32} />
                  <stop offset="95%" stopColor={trendColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#F1F1F1" vertical={false} strokeDasharray="0" />
              <XAxis dataKey="label" tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                width={72}
                tick={{ fill: COLORS.muted, fontSize: 11 }}
                tickFormatter={(v) => `${Math.round(Number(v))}`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v: number) => [formatPKRWithSymbol(v), "P&L"]}
                contentStyle={{
                  background: "rgba(255,255,255,0.98)",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  boxShadow: "0 12px 24px rgba(20,20,20,0.09)",
                }}
              />
              <Area type="monotone" dataKey="pnl" stroke="none" fill="url(#perchPnlFill)" fillOpacity={1} />
              <Line type="monotone" dataKey="pnl" stroke={trendColor} strokeWidth={3} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: trendColor }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          marginTop: 16,
        }}
      >
        <div style={{ ...cardStyle() }}>
          <div style={sectionLabelStyle()}>Allocation by stock</div>
          {allocationRows.length === 0 ? (
            <div style={{ marginTop: 12, color: COLORS.muted, fontSize: 14 }}>Allocation appears once you hold shares.</div>
          ) : (
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {allocationRows.map((item, index) => (
                <div key={item.ticker}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, letterSpacing: "0.03em", color: COLORS.text }}>{item.ticker}</span>
                    <span style={{ color: COLORS.muted, fontWeight: 700 }}>{item.pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 9, borderRadius: 999, background: "#F2F2F2", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, Math.max(3, item.pct))}%`,
                        borderRadius: 999,
                        background: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...cardStyle() }}>
          <div style={sectionLabelStyle()}>Cash vs invested</div>
          <div style={{ marginTop: 14, height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={[{ name: "Portfolio Mix", cash, invested: totalInvested }]}
                margin={{ top: 12, right: 8, left: 0, bottom: 2 }}
              >
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip
                  formatter={(value: number, key: string) => [
                    formatPKRWithSymbol(value),
                    key === "cash" ? "Cash" : "Invested",
                  ]}
                  contentStyle={{
                    background: "rgba(255,255,255,0.98)",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 10,
                    boxShadow: "0 12px 24px rgba(20,20,20,0.09)",
                  }}
                />
                <Bar dataKey="cash" stackId="mix" fill="#8A8A8A" radius={[8, 0, 0, 8]} />
                <Bar dataKey="invested" stackId="mix" fill={COLORS.orange} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: -2 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: COLORS.muted }}>Cash</span>
              <span style={{ fontWeight: 700, color: COLORS.text }}>
                {cashPct.toFixed(0)}% ({formatPKRWithSymbol(cash)})
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: COLORS.muted }}>Invested</span>
              <span style={{ fontWeight: 700, color: COLORS.text }}>
                {investedPct.toFixed(0)}% ({formatPKRWithSymbol(totalInvested)})
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, ...cardStyle(), padding: 0 }}>
        <div style={{ padding: 24, borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={sectionLabelStyle()}>Holdings</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: COLORS.bgSecondary }}>
                {["Stock", "Shares", "Avg buy", "Last", "Value", "P&L", "P&L %"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === "Stock" ? "left" : "right",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: COLORS.muted,
                      fontWeight: 600,
                      padding: "12px 16px",
                      borderBottom: `1px solid ${COLORS.border}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, color: COLORS.muted }}>
                    No open positions yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const up = r.pnl >= 0;
                  return (
                    <tr key={r.ticker} style={{ height: 62 }}>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid #EFEFEF" }}>
                        <div style={{ color: COLORS.text, fontWeight: 700, letterSpacing: "0.04em" }}>{r.ticker}</div>
                        <div
                          style={{
                            color: COLORS.muted,
                            fontSize: 12.5,
                            maxWidth: 320,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.name}
                        </div>
                      </td>
                      <td style={{ padding: "0 16px", borderBottom: "1px solid #EFEFEF", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.shares}</td>
                      <td style={{ padding: "0 16px", borderBottom: "1px solid #EFEFEF", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{formatPKRWithSymbol(r.avgBuyPrice)}</td>
                      <td style={{ padding: "0 16px", borderBottom: "1px solid #EFEFEF", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{formatPKRWithSymbol(r.px)}</td>
                      <td style={{ padding: "0 16px", borderBottom: "1px solid #EFEFEF", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{formatPKRWithSymbol(r.value)}</td>
                      <td style={{ padding: "0 16px", borderBottom: "1px solid #EFEFEF", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 760, color: up ? COLORS.gain : COLORS.loss }}>
                        {up ? "+" : ""}
                        {formatPKRWithSymbol(r.pnl)}
                      </td>
                      <td style={{ padding: "0 16px", borderBottom: "1px solid #EFEFEF", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 760, color: up ? COLORS.gain : COLORS.loss }}>
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

      <div style={{ marginTop: 16, ...cardStyle(), padding: 0 }}>
        <div style={{ padding: 24, borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={sectionLabelStyle()}>Transaction history</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: COLORS.bgSecondary }}>
                {["Time", "Side", "Ticker", "Shares", "Price", "Total"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === "Time" || h === "Side" || h === "Ticker" ? "left" : "right",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: COLORS.muted,
                      fontWeight: 600,
                      padding: "12px 16px",
                      borderBottom: `1px solid ${COLORS.border}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 24, color: COLORS.muted }}>
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                txs.map((t) => (
                  <tr key={t.id} style={{ height: 58 }}>
                    <td style={{ padding: "0 16px", borderBottom: "1px solid #EFEFEF", color: COLORS.muted, fontSize: 12 }}>
                      {new Date(t.timestamp).toLocaleString("en-PK")}
                    </td>
                    <td style={{ padding: "0 16px", borderBottom: "1px solid #EFEFEF" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: 52,
                          minHeight: 26,
                          borderRadius: 999,
                          padding: "0 10px",
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: "0.06em",
                          border: t.type === "BUY" ? "1px solid #BFE3D2" : "1px solid #F0C5BD",
                          color: t.type === "BUY" ? COLORS.gain : COLORS.loss,
                          background: t.type === "BUY" ? "#F2FAF6" : "#FFF5F3",
                        }}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td style={{ padding: "0 16px", borderBottom: "1px solid #EFEFEF", fontWeight: 700, letterSpacing: "0.03em" }}>{t.ticker}</td>
                    <td style={{ padding: "0 16px", borderBottom: "1px solid #EFEFEF", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{t.shares}</td>
                    <td style={{ padding: "0 16px", borderBottom: "1px solid #EFEFEF", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatPKRWithSymbol(t.price)}</td>
                    <td style={{ padding: "0 16px", borderBottom: "1px solid #EFEFEF", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatPKRWithSymbol(t.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
