"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { useLivePrices, type LiveQuote } from "@/lib/priceSimulator";
import { formatPKRWithSymbol, formatCompactPKR } from "@/lib/format";
import { getPsxChartUrl } from "@/lib/marketSnapshotUrl";
import { usePortfolio } from "@/hooks/usePortfolioState";
import { TradeSuccessScreen } from "@/components/trade/TradeSuccessScreen";
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

const NOT_AVAILABLE = "Not available";

type DetailStatsPayload = {
  ticker: string;
  tick: {
    price?: number;
    change?: number;
    changePercent?: number;
    value?: number;
    volume?: number;
    high?: number;
    low?: number;
    trades?: number;
    timestamp?: number;
  } | null;
  derived: {
    rangeHigh: number | null;
    rangeLow: number | null;
    avgDailyVolume: number | null;
    latestDailyOpen: number | null;
    dailySessions: number;
  };
};

function formatMoneyOrNA(
  value: number | null | undefined,
  fmt: (n: number) => string,
  options?: { allowZero?: boolean }
): string {
  if (value == null || !Number.isFinite(value)) return NOT_AVAILABLE;
  if (!options?.allowZero && value === 0) return NOT_AVAILABLE;
  return fmt(value);
}

function sortChartPointsAsc(points: Point[]): Point[] {
  return [...points].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function liveQuoteFromDetailTick(t: NonNullable<DetailStatsPayload["tick"]>): LiveQuote | null {
  if (typeof t.price !== "number" || !Number.isFinite(t.price)) return null;
  const change = typeof t.change === "number" && Number.isFinite(t.change) ? t.change : 0;
  const previousClose = Number((t.price - change).toFixed(2));
  const changePercent =
    previousClose !== 0 ? Number((((t.price - previousClose) / previousClose) * 100).toFixed(2)) : 0;
  const tsRaw = typeof t.timestamp === "number" && Number.isFinite(t.timestamp) ? t.timestamp : Date.now() / 1000;
  const ms = tsRaw > 10_000_000_000 ? tsRaw : tsRaw * 1000;
  return {
    price: Number(t.price.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePercent,
    volume: Math.max(0, Math.round(typeof t.volume === "number" && Number.isFinite(t.volume) ? t.volume : 0)),
    previousClose,
    date: new Date(ms).toISOString(),
    dayHigh: typeof t.high === "number" && Number.isFinite(t.high) ? t.high : undefined,
    dayLow: typeof t.low === "number" && Number.isFinite(t.low) ? t.low : undefined,
    sessionTurnover: typeof t.value === "number" && t.value > 0 ? t.value : undefined,
  };
}

export function StockDetailClient({ stock: base }: { stock: Stock }) {
  const ticker = base.ticker;
  const { getQuote, getHistory, estimateExecution } = useLivePrices();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastStreamQuoteRef = useRef<LiveQuote | null>(null);
  const prevTickerSyncRef = useRef<string | null>(null);
  if (prevTickerSyncRef.current !== ticker) {
    lastStreamQuoteRef.current = null;
    prevTickerSyncRef.current = ticker;
  }
  const history = getHistory(ticker) as Point[];
  const [detailStats, setDetailStats] = useState<DetailStatsPayload | null>(null);
  const [chartSeries, setChartSeries] = useState<Point[]>([]);
  const [chartLoadState, setChartLoadState] = useState<"idle" | "loading" | "ready" | "empty">("idle");
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

  const quoteFromDetail = useMemo(
    () => (detailStats?.tick ? liveQuoteFromDetailTick(detailStats.tick) : null),
    [detailStats]
  );

  const liveQuote = getQuote(ticker);
  if (liveQuote) lastStreamQuoteRef.current = liveQuote;
  const quote = liveQuote ?? lastStreamQuoteRef.current ?? quoteFromDetail;
  const hasQuote = quote != null;
  const price = hasQuote ? quote.price : null;
  const change = hasQuote ? quote.change : 0;
  const changePct = hasQuote ? quote.changePercent : 0;
  const volume = hasQuote ? quote.volume : 0;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/psx-terminal/detail-stats/${encodeURIComponent(ticker)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as DetailStatsPayload;
        if (!cancelled) setDetailStats(json);
      } catch {
        // Detail stats are best-effort; live quote remains authoritative for price.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  useEffect(() => {
    let cancelled = false;
    setChartLoadState("loading");
    const loadChart = async () => {
      try {
        const res = await fetch(getPsxChartUrl(ticker, range), { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) {
            setChartSeries([]);
            setChartLoadState("empty");
          }
          return;
        }
        const json = (await res.json()) as { data?: Point[] };
        const rows = Array.isArray(json.data) ? sortChartPointsAsc(json.data as Point[]) : [];
        if (cancelled) return;
        setChartSeries(rows);
        setChartLoadState(rows.length > 0 ? "ready" : "empty");
      } catch {
        if (!cancelled) {
          setChartSeries([]);
          setChartLoadState("empty");
        }
      }
    };
    void loadChart();
    return () => {
      cancelled = true;
    };
  }, [ticker, range]);

  const shares = Math.max(0, Math.floor(Number(sharesInput) || 0));
  const executionEstimate = estimateExecution(ticker, mode, shares);
  const estimatedExecutionPrice = executionEstimate?.estimatedPrice ?? price ?? 0;
  const est = shares * estimatedExecutionPrice;
  const dayHistory =
    history.length > 0
      ? sortChartPointsAsc(history)
      : hasQuote && quote
        ? [{ date: quote.date, price: quote.price, volume: quote.volume }]
        : [];
  const dayOpenFromBars = dayHistory[0]?.price;
  const dayOpenFromDaily = detailStats?.derived.latestDailyOpen;
  const dayOpen =
    typeof dayOpenFromDaily === "number" && Number.isFinite(dayOpenFromDaily) && dayOpenFromDaily > 0
      ? dayOpenFromDaily
      : typeof dayOpenFromBars === "number" && Number.isFinite(dayOpenFromBars)
        ? dayOpenFromBars
        : price;
  const localHigh = (() => {
    const vals = [
      ...(dayHistory.length ? dayHistory.map((p) => p.price) : []),
      ...(hasQuote && quote ? [quote.price, quote.dayHigh ?? quote.price] : price != null ? [price] : []),
    ];
    if (!vals.length) return 0;
    return Math.max(...vals);
  })();
  const localLow = (() => {
    const vals = [
      ...(dayHistory.length ? dayHistory.map((p) => p.price) : []),
      ...(hasQuote && quote ? [quote.price, quote.dayLow ?? quote.price] : price != null ? [price] : []),
    ];
    if (!vals.length) return 0;
    return Math.min(...vals);
  })();
  const prevClose = hasQuote && quote ? quote.previousClose : null;
  const averageVolumeFromDetail = detailStats?.derived.avgDailyVolume;
  const averageVolume =
    typeof averageVolumeFromDetail === "number" &&
    Number.isFinite(averageVolumeFromDetail) &&
    averageVolumeFromDetail > 0
      ? averageVolumeFromDetail
      : history.length > 0
        ? history.reduce((sum, p) => sum + p.volume, 0) / history.length
        : volume;
  const turnoverFromSession = hasQuote && quote?.sessionTurnover;
  const turnover =
    typeof turnoverFromSession === "number" && turnoverFromSession > 0
      ? turnoverFromSession
      : hasQuote && price != null && volume > 0
        ? volume * price
        : null;

  const chartData = useMemo(() => {
    if (chartSeries.length > 0) return chartSeries;
    if (range === "1D" && history.length > 0) return sortChartPointsAsc(history);
    if (price != null && Number.isFinite(price)) {
      return [{ date: new Date().toISOString(), price, volume: volume ?? 0 }];
    }
    return [];
  }, [chartSeries, range, history, price, volume]);

  const rangeLow = detailStats?.derived.rangeLow;
  const rangeHigh = detailStats?.derived.rangeHigh;
  const hasDetailRange =
    typeof rangeLow === "number" &&
    typeof rangeHigh === "number" &&
    Number.isFinite(rangeLow) &&
    Number.isFinite(rangeHigh) &&
    rangeHigh > 0 &&
    rangeLow > 0 &&
    rangeHigh >= rangeLow;

  const marketCapDisplay =
    base.marketCap > 0 ? formatCompactPKR(base.marketCap) : NOT_AVAILABLE;

  const holding = useMemo(
    () => portfolio.holdings.find((h) => h.ticker === ticker),
    [portfolio.holdings, ticker]
  );

  useEffect(() => {
    const route = `/stock/${ticker}`;
    void logAnalyticsEvent("stock_detail_viewed", { route, ticker });
    void logAnalyticsEvent("trade_ticket_opened", { route, ticker });
  }, [ticker]);

  async function onConfirm() {
    setMessage(null);
    if (!hasQuote || price == null) {
      setMessage("Live price is not available yet. Please wait for the market feed.");
      return;
    }
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
      void logAnalyticsEvent("first_trade_completed", {
        route: `/stock/${ticker}`,
        ticker,
        shares,
        estimated_price_per_share: estimatedExecutionPrice,
        invested_amount: est,
      });
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

  const up = hasQuote && change >= 0;
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
            {"← Back to PSX market"}
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
                  {hasQuote && price != null ? formatPKRWithSymbol(price) : "Awaiting live price"}
                </div>
              </div>
              <div className="perch-stock-change-block">
                <div
                  className="perch-fin-number"
                  style={{
                    fontSize: "clamp(17px, 4vw, 20px)",
                    fontWeight: 740,
                    color: hasQuote ? (up ? COLORS.gain : COLORS.loss) : COLORS.mutedSoft,
                  }}
                >
                  {hasQuote ? (
                    <>
                      {up ? "+" : ""}
                      {change.toFixed(2)} ({up ? "+" : ""}
                      {changePct.toFixed(2)}%)
                    </>
                  ) : (
                    "—"
                  )}
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
                Price chart
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
              <div
                className="perch-stock-chart-box"
                style={{
                  width: "100%",
                  marginTop: 12,
                  opacity: chartLoadState === "loading" ? 0.5 : 1,
                  transition: "opacity 180ms ease",
                }}
              >
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
                  <div className="perch-stock-ohlc-value">
                    {formatMoneyOrNA(
                      typeof dayOpen === "number" && Number.isFinite(dayOpen) ? dayOpen : null,
                      formatPKRWithSymbol,
                      { allowZero: true }
                    )}
                  </div>
                </div>
                <div>
                  <div style={statLabelStyle()}>High</div>
                  <div className="perch-stock-ohlc-value">
                    {localHigh > 0 ? formatPKRWithSymbol(localHigh) : NOT_AVAILABLE}
                  </div>
                </div>
                <div>
                  <div style={statLabelStyle()}>Low</div>
                  <div className="perch-stock-ohlc-value">
                    {localLow > 0 ? formatPKRWithSymbol(localLow) : NOT_AVAILABLE}
                  </div>
                </div>
                <div>
                  <div style={statLabelStyle()}>Prev close</div>
                  <div className="perch-stock-ohlc-value">
                    {formatMoneyOrNA(prevClose, formatPKRWithSymbol, { allowZero: true })}
                  </div>
                </div>
                <div>
                  <div style={statLabelStyle()}>Day volume</div>
                  <div className="perch-stock-ohlc-value">
                    {hasQuote ? formatCompactPKR(volume) : NOT_AVAILABLE}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12, color: COLORS.mutedSoft, fontSize: 12 }}>
                Live market data.
              </div>
            </section>

            <section style={{ ...panelStyle(), background: "#FFFFFF" }}>
              <div className="perch-stock-stats-grid">
                <div>
                  <div style={statLabelStyle()}>Price range (recent history)</div>
                <div
                  className="perch-fin-number perch-stock-stat-number"
                  style={{
                    marginTop: 6,
                    fontWeight: 720,
                    fontSize: 18,
                    color: COLORS.text,
                  }}
                >
                    {hasDetailRange
                      ? `${formatPKRWithSymbol(rangeLow!)} – ${formatPKRWithSymbol(rangeHigh!)}`
                      : NOT_AVAILABLE}
                  </div>
                </div>
                <div>
                  <div style={statLabelStyle()}>Market cap</div>
                  <div className="perch-fin-number perch-stock-stat-number" style={{ marginTop: 6, fontWeight: 700, fontSize: 18, color: COLORS.text }}>
                    {marketCapDisplay}
                  </div>
                </div>
                <div>
                  <div style={statLabelStyle()}>Average volume</div>
                  <div className="perch-fin-number perch-stock-stat-number" style={{ marginTop: 6, fontWeight: 700, fontSize: 18, color: COLORS.text }}>
                    {formatMoneyOrNA(averageVolume, formatCompactPKR)}
                  </div>
                </div>
                <div>
                  <div style={statLabelStyle()}>Turnover</div>
                  <div className="perch-fin-number perch-stock-stat-number" style={{ marginTop: 6, fontWeight: 700, fontSize: 18, color: COLORS.text }}>
                    {formatMoneyOrNA(turnover, formatCompactPKR)}
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
                  {hasQuote ? formatPKRWithSymbol(est) : NOT_AVAILABLE}
                </div>
              </div>
              <div className="perch-fin-number perch-ticket-secondary-value" style={{ marginTop: 8, color: COLORS.mutedSoft }}>
                {hasQuote ? `${formatPKRWithSymbol(estimatedExecutionPrice)} per share` : NOT_AVAILABLE}
              </div>
              <div style={{ marginTop: 4, color: COLORS.mutedSoft }}>
                Estimated fill may vary slightly from the latest market print.
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
                    disabled={isSubmitting || !hasQuote}
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
                      cursor: isSubmitting || !hasQuote ? "not-allowed" : "pointer",
                      opacity: isSubmitting || !hasQuote ? 0.55 : 1,
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
                    disabled={isSubmitting || !hasQuote}
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
                      cursor: isSubmitting || !hasQuote ? "not-allowed" : "pointer",
                      opacity: isSubmitting || !hasQuote ? 0.55 : 1,
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
