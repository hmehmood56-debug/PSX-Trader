"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Stock } from "@/lib/mockData";
import { useLivePrices } from "@/lib/priceSimulator";
import { formatPKRWithSymbol, formatCompactPKR } from "@/lib/format";
import { usePortfolio } from "@/hooks/usePortfolioState";
import { TradeSuccessScreen } from "@/components/trade/TradeSuccessScreen";
import { getReplayDatasetByTicker } from "@/lib/replayDataset";
import { startRouteProgress } from "@/lib/routeProgress";
import { logAnalyticsEvent } from "@/lib/analytics/client";

type Point = { date: string; price: number; volume: number };
type ChartRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

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
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: COLORS.mutedSoft,
    fontWeight: 650,
  };
}

const CHART_RANGES: readonly ChartRange[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothSeries(points: Point[]): Point[] {
  if (points.length < 3) return points;
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) return point;
    const prev = points[index - 1]?.price ?? point.price;
    const next = points[index + 1]?.price ?? point.price;
    const smoothedPrice = prev * 0.22 + point.price * 0.56 + next * 0.22;
    return { ...point, price: Number(smoothedPrice.toFixed(2)) };
  });
}

function buildRangeSeries(
  range: ChartRange,
  history: Point[],
  currentPrice: number,
  ticker: string
): Point[] {
  const now = Date.now();
  if (range === "1D") return history.length > 0 ? history : [{ date: new Date(now).toISOString(), price: currentPrice, volume: 0 }];

  const replay = getReplayDatasetByTicker(ticker)?.bars ?? [];
  const recentPrices = history.map((item) => item.price);
  const recentReturns = recentPrices.slice(1).map((price, idx) => {
    const prev = recentPrices[idx] ?? price;
    return prev > 0 ? (price - prev) / prev : 0;
  });
  const replayReturns = replay.slice(1).map((bar, idx) => {
    const prev = replay[idx]?.close ?? bar.close;
    return prev > 0 ? (bar.close - prev) / prev : 0;
  });
  const blendedReturns = [...replayReturns, ...recentReturns];
  const fallbackReturn = recentReturns[recentReturns.length - 1] ?? replayReturns[replayReturns.length - 1] ?? 0;

  const spec: Record<Exclude<ChartRange, "1D">, { points: number; stepMs: number }> = {
    "1W": { points: 7, stepMs: 24 * 60 * 60 * 1000 },
    "1M": { points: 30, stepMs: 24 * 60 * 60 * 1000 },
    "3M": { points: 66, stepMs: 24 * 60 * 60 * 1000 },
    "1Y": { points: 52, stepMs: 7 * 24 * 60 * 60 * 1000 },
    ALL: { points: 120, stepMs: 7 * 24 * 60 * 60 * 1000 },
  };

  const { points, stepMs } = spec[range];
  const generated = Array.from({ length: points }, (_, idx) => {
    const reverseIndex = points - idx - 1;
    const ret = blendedReturns[blendedReturns.length - 1 - (reverseIndex % Math.max(1, blendedReturns.length))] ?? fallbackReturn;
    const damp = range === "1W" ? 0.8 : range === "1M" ? 0.62 : 0.48;
    const move = clamp(ret * damp, -0.06, 0.06);
    const ts = now - (points - idx - 1) * stepMs;
    return { ts, move };
  });

  const series: Point[] = [];
  let rollingPrice = currentPrice;
  for (let i = generated.length - 1; i >= 0; i -= 1) {
    rollingPrice = Math.max(1, rollingPrice / (1 + generated[i].move));
  }
  generated.forEach((entry) => {
    rollingPrice = Math.max(1, rollingPrice * (1 + entry.move));
    series.push({
      date: new Date(entry.ts).toISOString(),
      price: Number(rollingPrice.toFixed(2)),
      volume: 0,
    });
  });

  return smoothSeries(series);
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

  const { portfolio, buyStock, sellStock } = usePortfolio();
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
  const [range, setRange] = useState<ChartRange>("1D");

  const shares = Math.max(0, Math.floor(Number(sharesInput) || 0));
  const executionEstimate = estimateExecution(ticker, mode, shares);
  const estimatedExecutionPrice = executionEstimate?.estimatedPrice ?? price;
  const est = shares * estimatedExecutionPrice;
  const dayHistory = history.length > 0 ? history : [{ date: quote?.date ?? new Date().toISOString(), price, volume }];
  const dayOpen = dayHistory[0]?.price ?? price;
  const localHigh = Math.max(price, ...dayHistory.map((p) => p.price));
  const localLow = Math.min(price, ...dayHistory.map((p) => p.price));
  const prevClose = quote?.previousClose ?? base.price - base.change;
  const averageVolume = history.length > 0 ? history.reduce((sum, p) => sum + p.volume, 0) / history.length : volume;
  const turnover = volume * price;
  const chartData = useMemo(() => buildRangeSeries(range, history, price, ticker), [range, history, price, ticker]);

  const holding = useMemo(
    () => portfolio.holdings.find((h) => h.ticker === ticker),
    [portfolio.holdings, ticker]
  );

  useEffect(() => {
    const route = `/stock/${ticker}`;
    void logAnalyticsEvent("stock_viewed", { route, ticker });
    void logAnalyticsEvent("trade_ticket_opened", { route, ticker });
  }, [ticker]);

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
        ? await buyStock(ticker, shares, estimatedExecutionPrice)
        : await sellStock(ticker, shares, estimatedExecutionPrice);
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
      startRouteProgress();
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
            onPrimary={() => {
              startRouteProgress();
              router.push("/dashboard");
            }}
            onSecondary={() => {
              startRouteProgress();
              router.push("/markets/psx");
            }}
            onAutoRedirect={() => {
              startRouteProgress();
              router.push("/dashboard");
            }}
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
              <div className="perch-stock-ticker">
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
                  }}
                >
                  {formatPKRWithSymbol(price)}
                </div>
              </div>
              <div className="perch-stock-change-block">
                <div
                  className="perch-fin-number"
                  style={{
                    fontSize: "clamp(17px, 4vw, 20px)",
                    fontWeight: 740,
                    color: up ? COLORS.gain : COLORS.loss,
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
              <div className="perch-stock-range-row" style={{ marginTop: 12 }}>
                {CHART_RANGES.map((item) => {
                  const active = item === range;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setRange(item)}
                      className={`perch-range-btn${active ? " perch-range-btn-active" : ""}`}
                      style={{
                        minHeight: 34,
                        padding: "0 12px",
                        borderRadius: 999,
                        border: active ? `1px solid #AF4300` : `1px solid ${COLORS.border}`,
                        background: active ? "#C45000" : "#FFFFFF",
                        color: active ? "#FFFFFF" : COLORS.muted,
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        cursor: "pointer",
                        WebkitTapHighlightColor: "transparent",
                        transition: "all 170ms ease",
                      }}
                      aria-pressed={active}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
              <div className="perch-stock-chart-box" style={{ width: "100%", marginTop: 12 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 4, left: -8, bottom: 4 }}>
                    <CartesianGrid stroke="#F3F3F3" vertical={false} strokeDasharray="0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: COLORS.mutedSoft, fontSize: 11 }}
                      minTickGap={22}
                      interval="preserveStartEnd"
                      tickFormatter={(value: string) =>
                        range === "1D"
                          ? new Date(value).toLocaleTimeString("en-PK", {
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : new Date(value).toLocaleDateString("en-PK", {
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
                        background: "rgba(255,255,255,0.98)",
                        border: `1px solid ${COLORS.borderStrong}`,
                        borderRadius: 10,
                        boxShadow: "0 14px 28px rgba(14,14,14,0.1)",
                        padding: "8px 10px",
                      }}
                      labelStyle={{ color: COLORS.muted, fontSize: 12, fontWeight: 600 }}
                      labelFormatter={(value: string) =>
                        range === "1D"
                          ? new Date(value).toLocaleString("en-PK", {
                              weekday: "short",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : new Date(value).toLocaleDateString("en-PK", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })
                      }
                      formatter={(value: number) => [formatPKRWithSymbol(value), "Price"]}
                    />
                    <Line
                      type="monotoneX"
                      dataKey="price"
                      stroke={COLORS.orange}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dot={false}
                      isAnimationActive
                      animationDuration={280}
                      animationEasing="ease-in-out"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="perch-stock-ohlc-grid" style={{ marginTop: 14 }}>
                <div>
                  <div style={statLabelStyle()}>Open</div>
                  <div className="perch-stock-ohlc-value">{formatPKRWithSymbol(dayOpen)}</div>
                </div>
                <div>
                  <div style={statLabelStyle()}>High</div>
                  <div className="perch-stock-ohlc-value">{formatPKRWithSymbol(localHigh)}</div>
                </div>
                <div>
                  <div style={statLabelStyle()}>Low</div>
                  <div className="perch-stock-ohlc-value">{formatPKRWithSymbol(localLow)}</div>
                </div>
                <div>
                  <div style={statLabelStyle()}>Prev close</div>
                  <div className="perch-stock-ohlc-value">{formatPKRWithSymbol(prevClose)}</div>
                </div>
                <div>
                  <div style={statLabelStyle()}>Day volume</div>
                  <div className="perch-stock-ohlc-value">{formatCompactPKR(volume)}</div>
                </div>
              </div>
              <div style={{ marginTop: 12, color: COLORS.mutedSoft, fontSize: 12 }}>
                Powered by Perch Sim Engine.
              </div>
            </section>

            <section style={{ ...panelStyle(), background: "#FFFFFF" }}>
              <div className="perch-stock-stats-grid">
                <div>
                  <div style={statLabelStyle()}>52-week range</div>
                <div
                  className="perch-fin-number perch-stock-stat-number"
                  style={{
                    marginTop: 6,
                    fontWeight: 720,
                    fontSize: 18,
                    color: COLORS.text,
                  }}
                >
                    {formatPKRWithSymbol(base.low52)} - {formatPKRWithSymbol(base.high52)}
                  </div>
                </div>
                <div>
                  <div style={statLabelStyle()}>Market cap</div>
                  <div className="perch-fin-number perch-stock-stat-number" style={{ marginTop: 6, fontWeight: 700, fontSize: 18, color: COLORS.text }}>
                    {formatCompactPKR(base.marketCap)}
                  </div>
                </div>
                <div>
                  <div style={statLabelStyle()}>Average volume</div>
                  <div className="perch-fin-number perch-stock-stat-number" style={{ marginTop: 6, fontWeight: 700, fontSize: 18, color: COLORS.text }}>
                    {formatCompactPKR(averageVolume)}
                  </div>
                </div>
                <div>
                  <div style={statLabelStyle()}>Turnover</div>
                  <div className="perch-fin-number perch-stock-stat-number" style={{ marginTop: 6, fontWeight: 700, fontSize: 18, color: COLORS.text }}>
                    {formatCompactPKR(turnover)}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside
            className="perch-stock-order-aside"
            style={{
              border: `1px solid ${COLORS.borderStrong}`,
              borderRadius: 16,
              background: "linear-gradient(180deg, #FFFFFF 0%, #FCFCFC 100%)",
              padding: "clamp(16px, 4vw, 20px)",
              boxShadow: "0 8px 24px rgba(18,18,18,0.04)",
            }}
          >
            <div style={{ ...statLabelStyle(), color: COLORS.muted }}>
              Order ticket
            </div>
            <div className="perch-fin-number" style={{ marginTop: 6, fontSize: 18, fontWeight: 730, color: COLORS.text }}>
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
                className="perch-ticket-shares-input"
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
              className="perch-ticket-summary"
              style={{
                marginTop: 16,
                background: COLORS.bgElevated,
                border: `1px solid ${COLORS.borderStrong}`,
                borderRadius: 12,
                padding: 16,
                fontSize: 13,
              }}
            >
              <div className="perch-ticket-row" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div className="perch-ticket-label" style={{ color: COLORS.mutedSoft, fontWeight: 600 }}>
                  Estimated price
                </div>
                <div
                  className="perch-fin-number perch-ticket-primary-value"
                  style={{
                    fontWeight: 740,
                    color: COLORS.text,
                    fontSize: 15,
                  }}
                >
                  {formatPKRWithSymbol(est)}
                </div>
              </div>
              <div className="perch-fin-number perch-ticket-secondary-value" style={{ marginTop: 8, color: COLORS.mutedSoft }}>
                {formatPKRWithSymbol(estimatedExecutionPrice)} per share
              </div>
              <div style={{ marginTop: 4, color: COLORS.mutedSoft }}>
                Price may vary slightly with simulated market conditions.
              </div>
              <div
                className="perch-ticket-row"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  marginTop: 8,
                }}
              >
                <div className="perch-ticket-label" style={{ color: COLORS.mutedSoft, fontWeight: 600 }}>
                  {mode === "BUY" ? "Available cash" : "Shares owned"}
                </div>
                <div
                  className="perch-fin-number perch-ticket-secondary-strong"
                  style={{
                    fontWeight: 730,
                    color: COLORS.text,
                    fontSize: 15,
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
