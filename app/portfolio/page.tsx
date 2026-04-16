"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
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
import { formatPKRWithSymbol } from "@/lib/format";
import { usePortfolio } from "@/hooks/usePortfolioState";
import { logAnalyticsEvent } from "@/lib/analytics/client";

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

const card =
  "rounded-lg border border-fintech-border bg-white p-4 shadow-card";

export default function PortfolioPage() {
  const { portfolio, transactions: txs } = usePortfolio();
  const { getQuote } = useLivePrices();

  useEffect(() => {
    void logAnalyticsEvent("portfolio_viewed", { route: "/portfolio" });
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
    <div className="space-y-6">
      <p className="text-sm text-fintech-muted">
        Holdings, allocation, and transaction history.
      </p>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">
            Cash balance
          </p>
          <p className="mt-2 text-xl font-bold tabular-nums text-fintech-text">
            {formatPKRWithSymbol(portfolio.cash)}
          </p>
        </div>
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">
            Holdings value
          </p>
          <p className="mt-2 text-xl font-bold tabular-nums text-fintech-text">
            {formatPKRWithSymbol(holdingsValue)}
          </p>
        </div>
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">
            Total portfolio value
          </p>
          <p className="mt-2 text-xl font-bold tabular-nums text-fintech-brand">
            {formatPKRWithSymbol(totalValue)}
          </p>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">
          Holdings
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-fintech-border">
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                  Stock
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                  Shares
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                  Avg buy
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                  Last
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                  Value
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                  P&amp;L
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                  P&amp;L %
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-fintech-muted"
                  >
                    No open positions. Buy from the{" "}
                    <Link
                      href="/stocks"
                      className="font-semibold text-fintech-brand hover:underline"
                    >
                      stocks
                    </Link>{" "}
                    page.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const up = r.pnl >= 0;
                  return (
                    <tr
                      key={r.ticker}
                      className="border-b border-fintech-border last:border-b-0 hover:bg-fintech-card"
                    >
                      <td className="px-3 py-3">
                        <div className="font-mono font-bold text-fintech-brand">
                          {r.ticker}
                        </div>
                        <div className="max-w-[200px] truncate text-xs text-fintech-muted">
                          {r.name}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-fintech-text">
                        {r.shares}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-fintech-text">
                        {formatPKRWithSymbol(r.avgBuyPrice)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-fintech-text">
                        {formatPKRWithSymbol(r.px)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-fintech-text">
                        {formatPKRWithSymbol(r.value)}
                      </td>
                      <td
                        className={`px-3 py-3 text-right font-mono font-semibold tabular-nums ${
                          up ? "text-fintech-gain" : "text-fintech-loss"
                        }`}
                      >
                        {up ? "+" : ""}
                        {formatPKRWithSymbol(r.pnl)}
                      </td>
                      <td
                        className={`px-3 py-3 text-right font-mono font-semibold tabular-nums ${
                          up ? "text-fintech-gain" : "text-fintech-loss"
                        }`}
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
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className={card}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">
            Allocation by stock
          </h2>
          {pieData.length === 0 ? (
            <p className="mt-6 text-sm text-fintech-muted">
              Chart appears once you hold shares.
            </p>
          ) : (
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {pieData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                        stroke="#FFFFFF"
                        strokeWidth={1}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatPKRWithSymbol(v)}
                    contentStyle={{
                      background: "#FFFFFF",
                      border: "1px solid #E8E8E8",
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

        <div className={card}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">
            Cash vs invested
          </h2>
          <div className="mt-4 h-72 w-full">
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
                  outerRadius={88}
                >
                  <Cell fill="#6B6B6B" stroke="#FFFFFF" strokeWidth={1} />
                  <Cell fill="#C45000" stroke="#FFFFFF" strokeWidth={1} />
                </Pie>
                <Tooltip
                  formatter={(v: number) => formatPKRWithSymbol(v)}
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "1px solid #E8E8E8",
                    borderRadius: 8,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">
          Transaction history
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-fintech-border">
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                  Time
                </th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                  Side
                </th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                  Ticker
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                  Shares
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                  Price
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {txs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-fintech-muted"
                  >
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                txs.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-fintech-border last:border-b-0 hover:bg-fintech-card"
                  >
                    <td className="px-3 py-3 text-xs text-fintech-muted">
                      {new Date(t.timestamp).toLocaleString("en-PK")}
                    </td>
                    <td
                      className={`px-3 py-3 text-sm font-semibold ${
                        t.type === "BUY" ? "text-fintech-gain" : "text-fintech-loss"
                      }`}
                    >
                      {t.type}
                    </td>
                    <td className="px-3 py-3 font-mono font-semibold text-fintech-text">
                      {t.ticker}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-fintech-text">
                      {t.shares}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-fintech-text">
                      {formatPKRWithSymbol(t.price)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-fintech-text">
                      {formatPKRWithSymbol(t.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
