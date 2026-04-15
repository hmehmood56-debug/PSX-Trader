"use client";

import type { CSSProperties } from "react";
import {
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
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

const PIE_COLORS = [
  "#C45000",
  "#D4723A",
  "#E8A078",
  "#6B6B6B",
  "#9E9E9E",
  "#C4C4C4",
  "#E07A3C",
  "#A85A24",
];

function cardStyle(): CSSProperties {
  return {
    background: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
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
  const pieData = rows.map((r) => ({
    name: r.ticker,
    value: r.value,
  }));

  const latestPnl = performancePoints[performancePoints.length - 1]?.pnl ?? 0;
  const trendColor = latestPnl >= 0 ? COLORS.gain : COLORS.loss;

  return (
    <>
      <div style={{ marginTop: 16, ...cardStyle() }}>
        <div style={sectionLabelStyle()}>Portfolio Performance</div>
        <div style={{ marginTop: 12, width: "100%", height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={performancePoints}>
              <XAxis dataKey="label" tick={{ fill: COLORS.muted, fontSize: 11 }} />
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
                  background: "#FFFFFF",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
              />
              <Line
                type="monotone"
                dataKey="pnl"
                stroke={trendColor}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
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
                    <tr key={r.ticker} style={{ height: 48 }}>
                      <td style={{ padding: "0 16px", borderBottom: `1px solid ${COLORS.border}` }}>
                        <div
                          style={{
                            color: COLORS.orange,
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                          }}
                        >
                          {r.ticker}
                        </div>
                        <div
                          style={{
                            color: COLORS.muted,
                            fontSize: 12,
                            maxWidth: 320,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.name}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "0 16px",
                          borderBottom: `1px solid ${COLORS.border}`,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {r.shares}
                      </td>
                      <td
                        style={{
                          padding: "0 16px",
                          borderBottom: `1px solid ${COLORS.border}`,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 700,
                        }}
                      >
                        {formatPKRWithSymbol(r.avgBuyPrice)}
                      </td>
                      <td
                        style={{
                          padding: "0 16px",
                          borderBottom: `1px solid ${COLORS.border}`,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 700,
                        }}
                      >
                        {formatPKRWithSymbol(r.px)}
                      </td>
                      <td
                        style={{
                          padding: "0 16px",
                          borderBottom: `1px solid ${COLORS.border}`,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 700,
                        }}
                      >
                        {formatPKRWithSymbol(r.value)}
                      </td>
                      <td
                        style={{
                          padding: "0 16px",
                          borderBottom: `1px solid ${COLORS.border}`,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 700,
                          color: up ? COLORS.gain : COLORS.loss,
                        }}
                      >
                        {up ? "+" : ""}
                        {formatPKRWithSymbol(r.pnl)}
                      </td>
                      <td
                        style={{
                          padding: "0 16px",
                          borderBottom: `1px solid ${COLORS.border}`,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 700,
                          color: up ? COLORS.gain : COLORS.loss,
                        }}
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={cardStyle()}>
          <div style={sectionLabelStyle()}>Allocation by stock</div>
          {pieData.length === 0 ? (
            <div style={{ marginTop: 12, color: COLORS.muted, fontSize: 14 }}>
              Chart appears once you hold shares.
            </div>
          ) : (
            <div style={{ marginTop: 12, width: "100%", height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={92} paddingAngle={2}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#FFFFFF" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatPKRWithSymbol(v)}
                    contentStyle={{
                      background: "#FFFFFF",
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 8,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div style={cardStyle()}>
          <div style={sectionLabelStyle()}>Cash vs invested</div>
          <div style={{ marginTop: 12, width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "Cash", value: cash },
                    { name: "Holdings", value: Math.max(0, holdingsValue) },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={92}
                >
                  <Cell fill={COLORS.muted} stroke="#FFFFFF" strokeWidth={1} />
                  <Cell fill={COLORS.orange} stroke="#FFFFFF" strokeWidth={1} />
                </Pie>
                <Tooltip
                  formatter={(v: number) => formatPKRWithSymbol(v)}
                  contentStyle={{
                    background: "#FFFFFF",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
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
                      textAlign:
                        h === "Time" || h === "Side" || h === "Ticker" ? "left" : "right",
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
                  <tr key={t.id} style={{ height: 48 }}>
                    <td
                      style={{
                        padding: "0 16px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        color: COLORS.muted,
                        fontSize: 12,
                      }}
                    >
                      {new Date(t.timestamp).toLocaleString("en-PK")}
                    </td>
                    <td
                      style={{
                        padding: "0 16px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        fontWeight: 700,
                        color: t.type === "BUY" ? COLORS.gain : COLORS.loss,
                      }}
                    >
                      {t.type}
                    </td>
                    <td
                      style={{
                        padding: "0 16px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        fontWeight: 700,
                        letterSpacing: "0.03em",
                      }}
                    >
                      {t.ticker}
                    </td>
                    <td
                      style={{
                        padding: "0 16px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {t.shares}
                    </td>
                    <td
                      style={{
                        padding: "0 16px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        textAlign: "right",
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatPKRWithSymbol(t.price)}
                    </td>
                    <td
                      style={{
                        padding: "0 16px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        textAlign: "right",
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatPKRWithSymbol(t.total)}
                    </td>
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
