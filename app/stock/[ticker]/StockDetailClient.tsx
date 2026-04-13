"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Stock } from "@/lib/mockData";
import { useLivePrices } from "@/lib/priceSimulator";
import { formatPKRWithSymbol, formatCompactPKR } from "@/lib/format";
import { buyStock, sellStock } from "@/lib/portfolioStore";
import { usePortfolioState } from "@/hooks/usePortfolioState";

type Point = { idx: number; price: number };

const card =
  "rounded-lg border border-fintech-border bg-white p-4 shadow-card";

function buildSimulatedHistory(endPrice: number): Point[] {
  const n = 30;
  const out: Point[] = [];
  let p = endPrice;
  for (let k = n - 1; k >= 0; k--) {
    out.unshift({ idx: n - 1 - k, price: Number(p.toFixed(2)) });
    const delta = (Math.random() * 2 - 1) * 0.005;
    p = Math.max(0.01, p / (1 + delta));
  }
  out[out.length - 1] = {
    ...out[out.length - 1],
    price: Number(endPrice.toFixed(2)),
  };
  return out;
}

export function StockDetailClient({ stock: base }: { stock: Stock }) {
  const ticker = base.ticker;
  const { getQuote } = useLivePrices();
  const quote = getQuote(ticker);
  const price = quote?.price ?? base.price;
  const change = quote?.change ?? base.change;
  const changePct = quote?.changePercent ?? base.changePercent;

  const portfolio = usePortfolioState();
  const [history, setHistory] = useState<Point[]>([]);
  const [mode, setMode] = useState<"BUY" | "SELL">("BUY");
  const [sharesInput, setSharesInput] = useState("10");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setHistory(buildSimulatedHistory(price));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  useEffect(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const next = [...h];
      next[next.length - 1] = {
        ...next[next.length - 1],
        price: Number(price.toFixed(2)),
      };
      return next;
    });
  }, [price]);

  const shares = Math.max(0, Math.floor(Number(sharesInput) || 0));
  const est = shares * price;

  const holding = useMemo(
    () => portfolio.holdings.find((h) => h.ticker === ticker),
    [portfolio.holdings, ticker]
  );

  function onConfirm() {
    setMessage(null);
    if (shares <= 0) {
      setMessage("Enter a valid number of shares.");
      return;
    }
    const res =
      mode === "BUY"
        ? buyStock(ticker, shares, price)
        : sellStock(ticker, shares, price);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    setMessage(`${mode === "BUY" ? "Bought" : "Sold"} ${shares} shares.`);
  }

  const up = change >= 0;

  return (
    <div className="space-y-6">
      <Link
        href="/stocks"
        className="text-sm font-medium text-fintech-muted hover:text-fintech-brand"
      >
        {"<- Back to stocks"}
      </Link>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">
              {base.sector}
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-fintech-text">
              {base.name}
            </h1>
            <p className="font-mono text-sm text-fintech-muted">{base.ticker}</p>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="text-xs font-medium text-fintech-muted">Last price</p>
              <p className="text-2xl font-bold tabular-nums text-fintech-text">
                {formatPKRWithSymbol(price)}
              </p>
            </div>
            <div className={up ? "text-fintech-gain" : "text-fintech-loss"}>
              <p className="text-sm font-semibold tabular-nums">
                {up ? "+" : ""}
                {change.toFixed(2)} ({up ? "+" : ""}
                {changePct.toFixed(2)}%)
              </p>
              <p className="text-xs text-fintech-muted">vs. simulated open</p>
            </div>
          </div>

          <div className={card}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-fintech-muted">
              Price (simulated intraday)
            </p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <XAxis dataKey="idx" hide />
                  <YAxis
                    domain={["auto", "auto"]}
                    width={52}
                    tick={{ fill: "#6B6B6B", fontSize: 11 }}
                    tickFormatter={(v) => `${Math.round(Number(v))}`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#FFFFFF",
                      border: "1px solid #E8E8E8",
                      borderRadius: 8,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    }}
                    labelStyle={{ color: "#6B6B6B" }}
                    formatter={(v: number) => [
                      formatPKRWithSymbol(v),
                      "Price",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#C45000"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className={card}>
              <p className="text-xs font-medium text-fintech-muted">
                52-week high
              </p>
              <p className="mt-1 font-mono text-base font-bold tabular-nums text-fintech-text">
                {formatPKRWithSymbol(base.high52)}
              </p>
            </div>
            <div className={card}>
              <p className="text-xs font-medium text-fintech-muted">
                52-week low
              </p>
              <p className="mt-1 font-mono text-base font-bold tabular-nums text-fintech-text">
                {formatPKRWithSymbol(base.low52)}
              </p>
            </div>
            <div className={card}>
              <p className="text-xs font-medium text-fintech-muted">Volume</p>
              <p className="mt-1 text-base font-semibold text-fintech-text">
                {formatCompactPKR(base.volume)}
              </p>
            </div>
            <div className={card}>
              <p className="text-xs font-medium text-fintech-muted">
                Market cap
              </p>
              <p className="mt-1 text-base font-semibold text-fintech-text">
                {formatCompactPKR(base.marketCap)}
              </p>
            </div>
          </div>

          <section className={card}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">
              About
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-fintech-text">
              {base.description}
            </p>
          </section>
        </div>

        <aside className="lg:col-span-1">
          <div className="sticky top-6 space-y-4 rounded-lg border border-fintech-border bg-white p-4 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">
              Trade
            </p>
            <div className="flex gap-2 rounded-btn bg-fintech-card p-1">
              <button
                type="button"
                onClick={() => setMode("BUY")}
                className={`flex-1 rounded-btn py-2 text-sm font-semibold ${
                  mode === "BUY"
                    ? "bg-white text-fintech-brand shadow-card"
                    : "text-fintech-muted"
                }`}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setMode("SELL")}
                className={`flex-1 rounded-btn py-2 text-sm font-semibold ${
                  mode === "SELL"
                    ? "bg-white text-fintech-loss shadow-card"
                    : "text-fintech-muted"
                }`}
              >
                Sell
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-fintech-muted">
                Shares
              </label>
              <input
                inputMode="numeric"
                value={sharesInput}
                onChange={(e) => setSharesInput(e.target.value)}
                className="mt-2 w-full rounded-lg border border-fintech-border bg-white px-3 py-2 font-mono text-sm text-fintech-text outline-none focus:border-fintech-brand focus:ring-2 focus:ring-fintech-brand/25"
              />
            </div>

            <div className="rounded-lg border border-fintech-border bg-fintech-card p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-fintech-muted">
                  {mode === "BUY" ? "Estimated cost" : "Estimated proceeds"}
                </span>
                <span className="font-mono font-semibold tabular-nums text-fintech-text">
                  {formatPKRWithSymbol(est)}
                </span>
              </div>
              <div className="mt-2 flex justify-between gap-2">
                <span className="text-fintech-muted">
                  {mode === "BUY" ? "Available cash" : "Shares owned"}
                </span>
                <span className="font-mono font-semibold tabular-nums text-fintech-text">
                  {mode === "BUY"
                    ? formatPKRWithSymbol(portfolio.cash)
                    : `${holding?.shares ?? 0}`}
                </span>
              </div>
            </div>

            {message && (
              <p className="text-sm text-fintech-muted" role="status">
                {message}
              </p>
            )}

            {mode === "BUY" ? (
              <button
                type="button"
                onClick={onConfirm}
                className="w-full rounded-btn bg-fintech-brand py-3 text-sm font-semibold text-white"
              >
                Buy {ticker}
              </button>
            ) : (
              <button
                type="button"
                onClick={onConfirm}
                className="w-full rounded-btn border-2 border-fintech-loss bg-white py-3 text-sm font-semibold text-fintech-loss"
              >
                Sell {ticker}
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
