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
  bgElevated: "#FCFCFC",
  bgSecondary: "#F7F7F7",
  border: "#E8E8E8",
  borderStrong: "#D9D9D9",
  text: "#1A1A1A",
  muted: "#6B6B6B",
  mutedSoft: "#8A8A8A",
  gain: "#007A4C",
  loss: "#C0392B",
} as const;

function panelStyle(): CSSProperties {
  return {
    background: COLORS.bgElevated,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
    padding: 20,
  };
}

function statLabelStyle(): CSSProperties {
  return {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: COLORS.mutedSoft,
    fontWeight: 600,
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
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 32px 36px" }}>
        <div style={{ marginBottom: 24 }}>
          <Link
            href="/stocks"
            style={{
              color: COLORS.muted,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            {"<- Back to stocks"}
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 360px",
            gap: 28,
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <section>
              <div style={statLabelStyle()}>{base.sector}</div>
              <h1 style={{ margin: "8px 0 0", fontSize: 32, fontWeight: 750, lineHeight: 1.12 }}>
                {base.name}
              </h1>
              <div
                style={{
                  marginTop: 8,
                  color: COLORS.muted,
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  letterSpacing: "0.02em",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {base.ticker}
              </div>
            </section>

            <section
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 24,
                alignItems: "end",
                paddingBottom: 8,
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <div>
                <div style={statLabelStyle()}>Last price</div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 48,
                    lineHeight: 1,
                    fontWeight: 760,
                    color: COLORS.text,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {formatPKRWithSymbol(price)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 740,
                    color: up ? COLORS.gain : COLORS.loss,
                    fontVariantNumeric: "tabular-nums",
                    textAlign: "right",
                  }}
                >
                  {up ? "+" : ""}
                  {change.toFixed(2)} ({up ? "+" : ""}
                  {changePct.toFixed(2)}%)
                </div>
                <div style={{ fontSize: 12, color: COLORS.mutedSoft, marginTop: 4, textAlign: "right" }}>
                  vs. simulated open
                </div>
              </div>
            </section>

            <section
              style={{
                border: `1px solid ${COLORS.borderStrong}`,
                borderRadius: 16,
                padding: "18px 20px 12px",
                background: "#FFFFFF",
              }}
            >
              <div style={statLabelStyle()}>
                Price (simulated intraday)
              </div>
              <div style={{ width: "100%", height: 360, marginTop: 12 }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <XAxis dataKey="idx" hide />
                    <YAxis
                      domain={["auto", "auto"]}
                      width={56}
                      tick={{ fill: COLORS.mutedSoft, fontSize: 11 }}
                      tickFormatter={(v) => `${Math.round(Number(v))}`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#FFFFFF",
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 8,
                        boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                      }}
                      labelStyle={{ color: COLORS.muted }}
                      formatter={(v: number) => [formatPKRWithSymbol(v), "Price"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke={COLORS.orange}
                      strokeWidth={2.4}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  columnGap: 26,
                  rowGap: 18,
                  padding: "8px 2px 0",
                }}
              >
                <div>
                  <div style={statLabelStyle()}>52-week high</div>
                  <div
                    style={{
                      marginTop: 6,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontWeight: 720,
                      fontSize: 18,
                      color: COLORS.text,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatPKRWithSymbol(base.high52)}
                  </div>
                </div>
                <div>
                  <div style={statLabelStyle()}>52-week low</div>
                  <div
                    style={{
                      marginTop: 6,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontWeight: 720,
                      fontSize: 18,
                      color: COLORS.text,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatPKRWithSymbol(base.low52)}
                  </div>
                </div>
                <div>
                  <div style={statLabelStyle()}>Volume</div>
                  <div style={{ marginTop: 6, fontWeight: 700, fontSize: 18, color: COLORS.text }}>
                    {formatCompactPKR(base.volume)}
                  </div>
                </div>
                <div>
                  <div style={statLabelStyle()}>Market cap</div>
                  <div style={{ marginTop: 6, fontWeight: 700, fontSize: 18, color: COLORS.text }}>
                    {formatCompactPKR(base.marketCap)}
                  </div>
                </div>
              </div>
            </section>

            <section style={{ ...panelStyle(), background: "#FFFFFF" }}>
              <div style={statLabelStyle()}>
                About
              </div>
              <div style={{ marginTop: 10, fontSize: 14, lineHeight: "24px", color: COLORS.text }}>
                {base.description}
              </div>
            </section>
          </div>

          <aside
            style={{
              border: `1px solid ${COLORS.borderStrong}`,
              borderRadius: 16,
              background: "#FFFFFF",
              padding: 18,
              position: "sticky",
              top: 18,
            }}
          >
            <div style={{ ...statLabelStyle(), color: COLORS.muted }}>
              Order ticket
            </div>
            <div style={{ marginTop: 6, fontSize: 18, fontWeight: 730, color: COLORS.text }}>
              {base.ticker}
            </div>
            <div style={{ marginTop: 2, fontSize: 13, color: COLORS.muted }}>
              {base.name}
            </div>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                gap: 8,
                padding: 4,
                background: COLORS.bgSecondary,
                borderRadius: 10,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <button
                type="button"
                onClick={() => setMode("BUY")}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 8,
                  border: "none",
                  background: mode === "BUY" ? COLORS.orange : "transparent",
                  color: mode === "BUY" ? "#FFFFFF" : COLORS.muted,
                  fontWeight: 720,
                  letterSpacing: "0.01em",
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
                  border: "none",
                  background: mode === "SELL" ? COLORS.loss : "transparent",
                  color: mode === "SELL" ? "#FFFFFF" : COLORS.muted,
                  fontWeight: 720,
                  letterSpacing: "0.01em",
                }}
              >
                Sell
              </button>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ ...statLabelStyle(), color: COLORS.muted }}>
                Shares
              </div>
              <input
                inputMode="numeric"
                value={sharesInput}
                onChange={(e) => setSharesInput(e.target.value)}
                style={{
                  marginTop: 8,
                  width: "100%",
                  height: 44,
                  borderRadius: 10,
                  border: `1px solid ${COLORS.border}`,
                  padding: "0 14px",
                  fontSize: 15,
                  outline: "none",
                  color: COLORS.text,
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
                background: COLORS.bgElevated,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: 14,
                fontSize: 13,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ color: COLORS.mutedSoft, fontWeight: 600 }}>
                  {mode === "BUY" ? "Estimated cost" : "Estimated proceeds"}
                </div>
                <div
                  style={{
                    fontWeight: 740,
                    color: COLORS.text,
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 15,
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
                <div style={{ color: COLORS.mutedSoft, fontWeight: 600 }}>
                  {mode === "BUY" ? "Available cash" : "Shares owned"}
                </div>
                <div
                  style={{
                    fontWeight: 730,
                    color: COLORS.text,
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 15,
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
              <div
                style={{
                  marginTop: 14,
                  border: `1px solid ${message.includes("Bought") || message.includes("Sold") ? "#CFE6DB" : "#F0D1CC"}`,
                  background:
                    message.includes("Bought") || message.includes("Sold")
                      ? "#F4FBF7"
                      : "#FFF6F4",
                  color:
                    message.includes("Bought") || message.includes("Sold")
                      ? COLORS.gain
                      : COLORS.loss,
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 13,
                  fontWeight: 650,
                }}
                role="status"
              >
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
                  height: 46,
                  borderRadius: 12,
                  border: `1px solid ${COLORS.orange}`,
                  background: COLORS.orange,
                  color: "#FFFFFF",
                  fontWeight: 740,
                  fontSize: 14,
                  letterSpacing: "0.02em",
                  boxShadow: "0 6px 18px rgba(196,80,0,0.24)",
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
                  height: 46,
                  borderRadius: 12,
                  border: `1px solid ${COLORS.loss}`,
                  background: "#FFFFFF",
                  color: COLORS.loss,
                  fontWeight: 740,
                  fontSize: 14,
                  letterSpacing: "0.02em",
                }}
              >
                Sell {ticker}
              </button>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
