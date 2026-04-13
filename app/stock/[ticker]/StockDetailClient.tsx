"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
    <div style={{ background: COLORS.bg }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 32 }}>
        <div style={{ marginBottom: 16 }}>
          <Link
            href="/stocks"
            style={{ color: COLORS.muted, textDecoration: "none", fontSize: 14 }}
          >
            {"<- Back to stocks"}
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "65% 35%",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: COLORS.muted,
                  fontWeight: 600,
                }}
              >
                {base.sector}
              </div>
              <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}>
                {base.name}
              </div>
              <div
                style={{
                  marginTop: 4,
                  color: COLORS.muted,
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                }}
              >
                {base.ticker}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>Last price</div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 28,
                    fontWeight: 700,
                    color: COLORS.text,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatPKRWithSymbol(price)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: up ? COLORS.gain : COLORS.loss,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {up ? "+" : ""}
                  {change.toFixed(2)} ({up ? "+" : ""}
                  {changePct.toFixed(2)}%)
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                  vs. simulated open
                </div>
              </div>
            </div>

            <div style={cardStyle()}>
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: COLORS.muted,
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                Price (simulated intraday)
              </div>
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <XAxis dataKey="idx" hide />
                    <YAxis
                      domain={["auto", "auto"]}
                      width={52}
                      tick={{ fill: COLORS.muted, fontSize: 11 }}
                      tickFormatter={(v) => `${Math.round(Number(v))}`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#FFFFFF",
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 8,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      }}
                      labelStyle={{ color: COLORS.muted }}
                      formatter={(v: number) => [formatPKRWithSymbol(v), "Price"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke={COLORS.orange}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={cardStyle()}>
                <div style={{ fontSize: 12, color: COLORS.muted }}>52-week high</div>
                <div
                  style={{
                    marginTop: 8,
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatPKRWithSymbol(base.high52)}
                </div>
              </div>
              <div style={cardStyle()}>
                <div style={{ fontSize: 12, color: COLORS.muted }}>52-week low</div>
                <div
                  style={{
                    marginTop: 8,
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatPKRWithSymbol(base.low52)}
                </div>
              </div>
              <div style={cardStyle()}>
                <div style={{ fontSize: 12, color: COLORS.muted }}>Volume</div>
                <div style={{ marginTop: 8, fontWeight: 700 }}>
                  {formatCompactPKR(base.volume)}
                </div>
              </div>
              <div style={cardStyle()}>
                <div style={{ fontSize: 12, color: COLORS.muted }}>Market cap</div>
                <div style={{ marginTop: 8, fontWeight: 700 }}>
                  {formatCompactPKR(base.marketCap)}
                </div>
              </div>
            </div>

            <div style={cardStyle()}>
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: COLORS.muted,
                  fontWeight: 600,
                }}
              >
                About
              </div>
              <div style={{ marginTop: 12, fontSize: 14, lineHeight: "22px" }}>
                {base.description}
              </div>
            </div>
          </div>

          <div style={cardStyle()}>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: COLORS.muted,
                fontWeight: 600,
              }}
            >
              Trade
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setMode("BUY")}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 8,
                  border: `1px solid ${mode === "BUY" ? COLORS.orange : COLORS.border}`,
                  background: mode === "BUY" ? "#F5E6DC" : "#FFFFFF",
                  color: mode === "BUY" ? COLORS.orange : COLORS.muted,
                  fontWeight: 700,
                }}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setMode("SELL")}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 8,
                  border: `1px solid ${mode === "SELL" ? COLORS.loss : COLORS.border}`,
                  background: "#FFFFFF",
                  color: mode === "SELL" ? COLORS.loss : COLORS.muted,
                  fontWeight: 700,
                }}
              >
                Sell
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>
                Shares
              </div>
              <input
                inputMode="numeric"
                value={sharesInput}
                onChange={(e) => setSharesInput(e.target.value)}
                style={{
                  marginTop: 8,
                  width: "100%",
                  height: 40,
                  borderRadius: 8,
                  border: `1px solid ${COLORS.border}`,
                  padding: "0 12px",
                  fontSize: 14,
                  outline: "none",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = COLORS.orange;
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(196,80,0,0.18)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = COLORS.border;
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            <div
              style={{
                marginTop: 16,
                background: COLORS.bgSecondary,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ color: COLORS.muted }}>
                  {mode === "BUY" ? "Estimated cost" : "Estimated proceeds"}
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    color: COLORS.text,
                    fontVariantNumeric: "tabular-nums",
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  }}
                >
                  {formatPKRWithSymbol(est)}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  marginTop: 8,
                }}
              >
                <div style={{ color: COLORS.muted }}>
                  {mode === "BUY" ? "Available cash" : "Shares owned"}
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    color: COLORS.text,
                    fontVariantNumeric: "tabular-nums",
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  }}
                >
                  {mode === "BUY"
                    ? formatPKRWithSymbol(portfolio.cash)
                    : `${holding?.shares ?? 0}`}
                </div>
              </div>
            </div>

            {message && (
              <div style={{ marginTop: 12, color: COLORS.muted, fontSize: 14 }} role="status">
                {message}
              </div>
            )}

            {mode === "BUY" ? (
              <button
                type="button"
                onClick={onConfirm}
                style={{
                  marginTop: 16,
                  width: "100%",
                  height: 44,
                  borderRadius: 10,
                  border: `1px solid ${COLORS.orange}`,
                  background: COLORS.orange,
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                Buy {ticker}
              </button>
            ) : (
              <button
                type="button"
                onClick={onConfirm}
                style={{
                  marginTop: 16,
                  width: "100%",
                  height: 44,
                  borderRadius: 10,
                  border: `2px solid ${COLORS.loss}`,
                  background: "#FFFFFF",
                  color: COLORS.loss,
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                Sell {ticker}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
