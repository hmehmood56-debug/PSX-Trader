"use client";

import Link from "next/link";
import { useLivePrices } from "@/lib/priceSimulator";
import {
  getTransactionHistory,
  type Transaction,
} from "@/lib/portfolioStore";
import { formatPKRWithSymbol } from "@/lib/format";
import { usePortfolioState } from "@/hooks/usePortfolioState";
import { useMemo, useState, useEffect } from "react";

function signedPkr(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${formatPKRWithSymbol(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const card =
  "rounded-lg border border-fintech-border bg-white p-4 shadow-card";

export default function DashboardPage() {
  const portfolio = usePortfolioState();
  const { getQuote, getStocksWithLive } = useLivePrices();
  const [recent, setRecent] = useState<Transaction[]>([]);

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

  return (
    <div className="space-y-6">
      <p className="text-sm text-fintech-muted">
        Prices refresh every few seconds (simulated).
      </p>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          valueClass={todayPnL >= 0 ? "text-fintech-gain" : "text-fintech-loss"}
        />
        <StatCard
          label="Total Return"
          value={`${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(2)}%`}
          valueClass={
            totalReturnPct >= 0 ? "text-fintech-gain" : "text-fintech-loss"
          }
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">
            Top Gainers
          </h2>
          <ul className="mt-4 divide-y divide-fintech-border">
            {gainers.map((s) => (
              <li
                key={s.ticker}
                className="flex items-center justify-between py-3 first:pt-0"
              >
                <Link
                  href={`/stock/${s.ticker}`}
                  className="font-bold text-fintech-brand hover:underline"
                >
                  {s.ticker}
                </Link>
                <span className="text-sm font-semibold tabular-nums text-fintech-gain">
                  +{s.changePercent.toFixed(2)}%
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className={card}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">
            Top Losers
          </h2>
          <ul className="mt-4 divide-y divide-fintech-border">
            {losers.map((s) => (
              <li
                key={s.ticker}
                className="flex items-center justify-between py-3 first:pt-0"
              >
                <Link
                  href={`/stock/${s.ticker}`}
                  className="font-bold text-fintech-brand hover:underline"
                >
                  {s.ticker}
                </Link>
                <span className="text-sm font-semibold tabular-nums text-fintech-loss">
                  {s.changePercent.toFixed(2)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={card}>
        <div className="flex items-center justify-between gap-2 border-b border-fintech-border pb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">
            Recent Transactions
          </h2>
          <Link
            href="/portfolio"
            className="text-xs font-semibold text-fintech-brand hover:underline"
          >
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-fintech-muted">
            No trades yet. Browse{" "}
            <Link href="/stocks" className="font-semibold text-fintech-brand hover:underline">
              stocks
            </Link>{" "}
            to place your first order.
          </p>
        ) : (
          <div className="mt-0 divide-y divide-fintech-border">
            {recent.map((tx) => (
              <div
                key={tx.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <span
                  className={`font-semibold ${
                    tx.type === "BUY" ? "text-fintech-gain" : "text-fintech-loss"
                  }`}
                >
                  {tx.type}
                </span>
                <span className="font-mono font-semibold tabular-nums text-fintech-text">
                  {tx.ticker}
                </span>
                <span className="text-fintech-muted">
                  {tx.shares} sh @ {formatPKRWithSymbol(tx.price)}
                </span>
                <span className="font-semibold tabular-nums text-fintech-text">
                  {formatPKRWithSymbol(tx.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClass = "text-fintech-text",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className={card}>
      <p className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">
        {label}
      </p>
      <p
        className={`mt-2 text-xl font-bold tabular-nums tracking-tight ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}
