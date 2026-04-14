"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";
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
import { TradeSuccessScreen } from "@/components/trade/TradeSuccessScreen";

type Point = { date: string; price: number; volume: number };

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

export function StockDetailClient({ stock: base }: { stock: Stock }) {
  const ticker = base.ticker;
  const { getQuote, getHistory, estimateExecution } = useLivePrices();
  const router = useRouter();
  const searchParams = useSearchParams();
  const quote = getQuote(ticker);
  const price = quote?.price ?? base.price;
  const change = quote?.change ?? base.change;
  const changePct = quote?.changePercent ?? base.changePercent;
  const volume = quote?.volume ?? base.volume;
  const history = getHistory(ticker) as Point[];

  const portfolio = usePortfolioState();
  const [mode, setMode] = useState<"BUY" | "SELL">("BUY");
  const [sharesInput, setSharesInput] = useState("10");
  const [message, setMessage] = useState<string | null>(null);
  const [standardSuccess, setStandardSuccess] = useState<{
    shares: number;
    total: number;
    side: "BUY" | "SELL";
    timestampLabel: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const shares = Math.max(0, Math.floor(Number(sharesInput) || 0));
  const executionEstimate = estimateExecution(ticker, mode, shares);
  const estimatedExecutionPrice = executionEstimate?.estimatedPrice ?? price;
  const est = shares * estimatedExecutionPrice;
  const recentHistory = history.slice(-18);
  const localHigh = recentHistory.length > 0 ? Math.max(...recentHistory.map((p) => p.price)) : price;
  const localLow = recentHistory.length > 0 ? Math.min(...recentHistory.map((p) => p.price)) : price;
  const averageVolume = history.length > 0 ? history.reduce((sum, p) => sum + p.volume, 0) / history.length : volume;
  const turnover = volume * price;

  const holding = useMemo(
    () => portfolio.holdings.find((h) => h.ticker === ticker),
    [portfolio.holdings, ticker]
  );

  async function onConfirm() {
    setMessage(null);
    if (shares <= 0) {
      setMessage("Enter a valid number of shares.");
      return;
    }
    const onboarding = searchParams.get("onboarding") === "1";
    setIsSubmitting(true);
    const delayMs = executionEstimate?.delayMs ?? 450;
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    const res =
      mode === "BUY"
        ? buyStock(ticker, shares, estimatedExecutionPrice)
        : sellStock(ticker, shares, estimatedExecutionPrice);
    setIsSubmitting(false);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    if (onboarding && mode === "BUY") {
      const params = new URLSearchParams({
        tradeComplete: "1",
        ticker,
        invested: `${Math.round(est)}`,
        shares: `${shares}`,
      });
      router.push(`/start?${params.toString()}`);
      return;
    }
    setStandardSuccess({
      shares,
      total: est,
      side: mode,
      timestampLabel: new Date().toLocaleString("en-PK", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    });
  }

  const up = change >= 0;
  if (standardSuccess) {
    return (
      <div style={{ background: COLORS.bg }}>
        <div
          className="perch-shell perch-shell-stock"
          style={{ paddingTop: "clamp(20px, 4vw, 28px)", paddingBottom: "clamp(28px, 6vw, 36px)" }}
        >
          <TradeSuccessScreen
            variant="standard"
            ticker={ticker}
            companyName={base.name}
            investedAmount={standardSuccess.total}
            shares={standardSuccess.shares}
            side={standardSuccess.side}
            timestampLabel={standardSuccess.timestampLabel}
            onPrimary={() => router.push("/dashboard")}
            onSecondary={() => router.push("/markets/psx")}
            onAutoRedirect={() => router.push("/dashboard")}
            autoRedirectMs={2500}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.bg }}>
      <div
        className="perch-shell perch-shell-stock"
        style={{ paddingTop: "clamp(20px, 4vw, 28px)", paddingBottom: "clamp(28px, 6vw, 36px)" }}
      >
        <div style={{ marginBottom: 20 }}>
          <Link
            href="/markets/psx"
            style={{
              color: COLORS.muted,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.02em",
              display: "inline-flex",
              minHeight: 44,
              alignItems: "center",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {"← Back to simulated PSX"}
          </Link>
        </div>

        <div className="perch-stock-detail-grid">
          <div className="perch-stock-detail-main" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <section>
              <div style={statLabelStyle()}>{base.sector}</div>
              <h1
                style={{
                  margin: "8px 0 0",
                  fontSize: "clamp(22px, 5vw, 32px)",
                  fontWeight: 750,
                  lineHeight: 1.12,
                }}
              >
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
              className="perch-stock-price-row"
              style={{
                paddingBottom: 8,
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <div>
                <div style={statLabelStyle()}>Last price</div>
                <div
                  className="perch-stock-price-big"
                  style={{
                    marginTop: 8,
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
              <div className="perch-stock-change-block">
                <div
                  style={{
                    fontSize: "clamp(17px, 4vw, 20px)",
                    fontWeight: 740,
                    color: up ? COLORS.gain : COLORS.loss,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {up ? "+" : ""}
                  {change.toFixed(2)} ({up ? "+" : ""}
                  {changePct.toFixed(2)}%)
                </div>
                <div style={{ fontSize: 12, color: COLORS.mutedSoft, marginTop: 4 }}>
                  Today&apos;s change
                </div>
              </div>
            </section>

            <section
              style={{
                border: `1px solid ${COLORS.borderStrong}`,
                borderRadius: 16,
                padding: "clamp(14px, 3vw, 18px) clamp(14px, 3vw, 20px) 12px",
                background: "#FFFFFF",
              }}
            >
              <div style={statLabelStyle()}>
                Price replay
              </div>
              <div className="perch-stock-chart-box" style={{ width: "100%", marginTop: 12 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: COLORS.mutedSoft, fontSize: 11 }}
                      tickFormatter={(value: string) =>
                        new Date(value).toLocaleDateString("en-PK", {
                          month: "short",
                          day: "numeric",
                        })
                      }
                      axisLine={false}
                      tickLine={false}
                    />
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
                      labelFormatter={(value: string) =>
                        new Date(value).toLocaleDateString("en-PK", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      }
                      formatter={(value: number) => [formatPKRWithSymbol(value), "Price"]}
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
              <div style={{ marginTop: 12, color: COLORS.mutedSoft, fontSize: 12 }}>
                Powered by Perch Sim Engine. Prices update continuously from current market anchors.
              </div>
            </section>

            <section>
              <div className="perch-stock-stats-grid">
                <div>
                  <div style={statLabelStyle()}>Day range</div>
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
                    {formatPKRWithSymbol(localLow)} - {formatPKRWithSymbol(localHigh)}
                  </div>
                </div>
                <div>
                  <div style={statLabelStyle()}>52-week range</div>
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
                    {formatPKRWithSymbol(base.low52)} - {formatPKRWithSymbol(base.high52)}
                  </div>
                </div>
                <div>
                  <div style={statLabelStyle()}>Volume</div>
                  <div style={{ marginTop: 6, fontWeight: 700, fontSize: 18, color: COLORS.text }}>
                    {formatCompactPKR(volume)}
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
              <div style={statLabelStyle()}>Company snapshot</div>
              <div style={{ marginTop: 10, display: "grid", gap: 8, fontSize: 14, lineHeight: "22px", color: COLORS.text }}>
                <div>Sector identity: <strong>{base.sector}</strong></div>
                <div>Average volume: <strong>{formatCompactPKR(averageVolume)}</strong></div>
                <div>Turnover: <strong>{formatCompactPKR(turnover)}</strong></div>
                <div>Estimated price: <strong>{formatPKRWithSymbol(estimatedExecutionPrice)}</strong></div>
                <div>Today&apos;s change: <strong>{up ? "+" : ""}{changePct.toFixed(2)}%</strong></div>
                {typeof base.dividendYield === "number" ? (
                  <div>Dividend yield: <strong>{base.dividendYield.toFixed(2)}%</strong></div>
                ) : null}
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
            className="perch-stock-order-aside"
            style={{
              border: `1px solid ${COLORS.borderStrong}`,
              borderRadius: 16,
              background: "#FFFFFF",
              padding: "clamp(16px, 4vw, 18px)",
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
                  minHeight: 44,
                  borderRadius: 8,
                  border: "none",
                  background: mode === "BUY" ? COLORS.orange : "transparent",
                  color: mode === "BUY" ? "#FFFFFF" : COLORS.muted,
                  fontWeight: 720,
                  letterSpacing: "0.01em",
                  fontSize: 15,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setMode("SELL")}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 8,
                  border: "none",
                  background: mode === "SELL" ? COLORS.loss : "transparent",
                  color: mode === "SELL" ? "#FFFFFF" : COLORS.muted,
                  fontWeight: 720,
                  letterSpacing: "0.01em",
                  fontSize: 15,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
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
                  minHeight: 48,
                  borderRadius: 10,
                  border: `1px solid ${COLORS.border}`,
                  padding: "0 16px",
                  fontSize: 16,
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
                  Estimated price
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
              <div style={{ marginTop: 8, color: COLORS.mutedSoft }}>
                {formatPKRWithSymbol(estimatedExecutionPrice)} per share
              </div>
              <div style={{ marginTop: 4, color: COLORS.mutedSoft }}>
                Price may vary slightly with simulated market conditions.
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

            {mode === "BUY"
              ? (
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={isSubmitting}
                    style={{
                      marginTop: 16,
                      width: "100%",
                      minHeight: 50,
                      borderRadius: 12,
                      border: `1px solid ${COLORS.orange}`,
                      background: COLORS.orange,
                      color: "#FFFFFF",
                      fontWeight: 740,
                      fontSize: 16,
                      letterSpacing: "0.02em",
                      boxShadow: "0 6px 18px rgba(196,80,0,0.24)",
                      cursor: isSubmitting ? "wait" : "pointer",
                      opacity: isSubmitting ? 0.8 : 1,
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    {isSubmitting ? "Confirming order..." : `Buy ${ticker}`}
                  </button>
                )
              : (
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={isSubmitting}
                    style={{
                      marginTop: 16,
                      width: "100%",
                      minHeight: 50,
                      borderRadius: 12,
                      border: `1px solid ${COLORS.loss}`,
                      background: "#FFFFFF",
                      color: COLORS.loss,
                      fontWeight: 740,
                      fontSize: 16,
                      letterSpacing: "0.02em",
                      cursor: isSubmitting ? "wait" : "pointer",
                      opacity: isSubmitting ? 0.8 : 1,
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    {isSubmitting ? "Confirming order..." : `Sell ${ticker}`}
                  </button>
                )}
          </aside>
        </div>
      </div>
    </div>
  );
}
