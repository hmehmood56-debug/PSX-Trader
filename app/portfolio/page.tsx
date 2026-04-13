"use client";

import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useLivePrices } from "@/lib/priceSimulator";
import { getStockByTicker } from "@/lib/mockData";
import { getTransactionHistory, type Transaction } from "@/lib/portfolioStore";
import { formatPKRWithSymbol } from "@/lib/format";
import { usePortfolioState } from "@/hooks/usePortfolioState";
import { useEffect, useState } from "react";

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

export default function PortfolioPage() {
  const portfolio = usePortfolioState();
  const { getQuote } = useLivePrices();
  const [txs, setTxs] = useState<Transaction[]>([]);

  useEffect(() => {
    setTxs(getTransactionHistory());
    const onUp = () => setTxs(getTransactionHistory());
    window.addEventListener("psx-portfolio-updated", onUp);
    return () => window.removeEventListener("psx-portfolio-updated", onUp);
  }, []);

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

  const holdingsValue = rows.reduce((s, r) => s + r.value, 0);
  const totalValue = portfolio.cash + holdingsValue;

  const pieData = useMemo(
    () =>
      rows.map((r) => ({
        name: r.ticker,
        value: r.value,
      })),
    [rows]
  );

  return (
    <div style={{ background: COLORS.bg }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div style={cardStyle()}>
            <div style={labelStyle()}>Cash balance</div>
            <div style={{ marginTop: 10, fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {formatPKRWithSymbol(portfolio.cash)}
            </div>
          </div>
          <div style={cardStyle()}>
            <div style={labelStyle()}>Holdings value</div>
            <div style={{ marginTop: 10, fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {formatPKRWithSymbol(holdingsValue)}
            </div>
          </div>
          <div style={cardStyle()}>
            <div style={labelStyle()}>Total portfolio value</div>
            <div style={{ marginTop: 10, fontSize: 28, fontWeight: 700, color: COLORS.orange, fontVariantNumeric: "tabular-nums" }}>
              {formatPKRWithSymbol(totalValue)}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, ...cardStyle(), padding: 0 }}>
          <div style={{ padding: 24, borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={labelStyle()}>Holdings</div>
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
                      No open positions. Buy from the{" "}
                      <Link href="/stocks" style={{ color: COLORS.orange, fontWeight: 600, textDecoration: "none" }}>
                        stocks
                      </Link>{" "}
                      page.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const up = r.pnl >= 0;
                    return (
                      <tr key={r.ticker} style={{ height: 48 }}>
                        <td style={{ padding: "0 16px", borderBottom: `1px solid ${COLORS.border}` }}>
                          <div style={{ color: COLORS.orange, fontWeight: 700, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                            {r.ticker}
                          </div>
                          <div style={{ color: COLORS.muted, fontSize: 12, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.name}
                          </div>
                        </td>
                        <td style={{ padding: "0 16px", borderBottom: `1px solid ${COLORS.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {r.shares}
                        </td>
                        <td style={{ padding: "0 16px", borderBottom: `1px solid ${COLORS.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                          {formatPKRWithSymbol(r.avgBuyPrice)}
                        </td>
                        <td style={{ padding: "0 16px", borderBottom: `1px solid ${COLORS.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                          {formatPKRWithSymbol(r.px)}
                        </td>
                        <td style={{ padding: "0 16px", borderBottom: `1px solid ${COLORS.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                          {formatPKRWithSymbol(r.value)}
                        </td>
                        <td style={{ padding: "0 16px", borderBottom: `1px solid ${COLORS.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: up ? COLORS.gain : COLORS.loss }}>
                          {up ? "+" : ""}
                          {formatPKRWithSymbol(r.pnl)}
                        </td>
                        <td style={{ padding: "0 16px", borderBottom: `1px solid ${COLORS.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: up ? COLORS.gain : COLORS.loss }}>
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
            <div style={labelStyle()}>Allocation by stock</div>
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
            <div style={labelStyle()}>Cash vs invested</div>
            <div style={{ marginTop: 12, width: "100%", height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Cash", value: portfolio.cash },
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
            <div style={labelStyle()}>Transaction history</div>
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
                    <tr key={t.id} style={{ height: 48 }}>
                      <td style={{ padding: "0 16px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted, fontSize: 12 }}>
                        {new Date(t.timestamp).toLocaleString("en-PK")}
                      </td>
                      <td style={{ padding: "0 16px", borderBottom: `1px solid ${COLORS.border}`, fontWeight: 700, color: t.type === "BUY" ? COLORS.gain : COLORS.loss }}>
                        {t.type}
                      </td>
                      <td style={{ padding: "0 16px", borderBottom: `1px solid ${COLORS.border}`, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontWeight: 700 }}>
                        {t.ticker}
                      </td>
                      <td style={{ padding: "0 16px", borderBottom: `1px solid ${COLORS.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {t.shares}
                      </td>
                      <td style={{ padding: "0 16px", borderBottom: `1px solid ${COLORS.border}`, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        {formatPKRWithSymbol(t.price)}
                      </td>
                      <td style={{ padding: "0 16px", borderBottom: `1px solid ${COLORS.border}`, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        {formatPKRWithSymbol(t.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
