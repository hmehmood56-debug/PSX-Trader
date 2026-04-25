"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "./StockDetailClient.module.css";
import type { Stock } from "@/lib/mockData";
import { useLivePrices, type LiveQuote } from "@/lib/priceSimulator";
import { formatPKRWithSymbol, formatCompactPKR } from "@/lib/format";
import { getPsxChartUrl } from "@/lib/marketSnapshotUrl";
import { getDisplaySectorForTicker } from "@/lib/psxSymbolMetadata";
import { getPsxCompanyMetadata } from "@/lib/psxCompanyMetadata";
import { usePortfolio } from "@/hooks/usePortfolioState";
import { StockLogo } from "@/components/common/StockLogo";
import { TradeSuccessScreen } from "@/components/trade/TradeSuccessScreen";
import { startRouteProgress } from "@/lib/routeProgress";
import { logAnalyticsEvent } from "@/lib/analytics/client";
import { BarChart3, FileText } from "lucide-react";
import {
  StockPriceLwcChart,
  type StockDetailChartRange,
  type StockChartPoint,
} from "./StockPriceLwcChart";

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

/** Deeper, less saturated than brand orange — chart accent only */
const CHART_LINE = "#8B4510";
const CHART_FILL_TOP = "rgba(139, 69, 16, 0.09)";
const ORDER_BORDER = "#E9E3DC";
const PANEL_TINT = "#FAF8F5";
const TOGGLE_INACTIVE = "#F1EEEA";

function statLabelStyle(): CSSProperties {
  return {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: COLORS.mutedSoft,
    fontWeight: 650,
  };
}

const CHART_RANGES: readonly StockDetailChartRange[] = [
  "1D",
  "1W",
  "1M",
  "3M",
  "1Y",
  "ALL",
] as const;

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

function sortChartPointsAsc(points: StockChartPoint[]): StockChartPoint[] {
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
  const history = getHistory(ticker) as StockChartPoint[];
  const [detailStats, setDetailStats] = useState<DetailStatsPayload | null>(null);
  const [chartSeries, setChartSeries] = useState<StockChartPoint[]>([]);
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
  const [range, setRange] = useState<StockDetailChartRange>("1D");
  const [activeTab, setActiveTab] = useState<"overview" | "fundamentals">("overview");
  const [fundamentals, setFundamentals] = useState<any | null>(null);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(false);
  const [displayedTab, setDisplayedTab] = useState<"overview" | "fundamentals">("overview");
  const [isTabContentVisible, setIsTabContentVisible] = useState(true);
  const [isOverviewMounted, setIsOverviewMounted] = useState(false);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
  const [canExpandOverview, setCanExpandOverview] = useState(false);
  const overviewTextRef = useRef<HTMLParagraphElement | null>(null);

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
        const json = (await res.json()) as { data?: StockChartPoint[] };
        const rows = Array.isArray(json.data)
          ? sortChartPointsAsc(json.data as StockChartPoint[])
          : [];
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

  useEffect(() => {
    let cancelled = false;
    const BASE_URL = "https://soft-resonance-1d40.hmehmood56.workers.dev";

    const loadFundamentals = async () => {
      setFundamentalsLoading(true);
      try {
        const res = await fetch(
          `${BASE_URL}/fundamentals?ticker=${encodeURIComponent(ticker)}`
        );
        console.log("[fundamentals response]", await res.clone().json());
        if (!res.ok) {
          if (!cancelled) setFundamentals(null);
          return;
        }
        const json = (await res.json()) as { data?: { financialStats?: Record<string, unknown> } | Record<string, unknown> };
        const payload = json.data;
        console.log("[fundamentals payload]", payload);
        if (!cancelled) {
          setFundamentals(
            payload?.financialStats ??
            payload ??
            null
          );
        }
      } catch {
        if (!cancelled) setFundamentals(null);
      } finally {
        if (!cancelled) setFundamentalsLoading(false);
      }
    };
    void loadFundamentals();

    return () => {
      cancelled = true;
    };
  }, [ticker]);

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
  const displaySector = getDisplaySectorForTicker(base.ticker, base.sector);
  const companyMeta = getPsxCompanyMetadata(ticker) as
    | (ReturnType<typeof getPsxCompanyMetadata> & { businessDescription?: string })
    | undefined;
  const baseMeta = base as Stock & {
    description?: string;
    founded?: string | number;
    hq?: string;
    headquarters?: string;
    employees?: string | number;
    website?: string;
  };
  const overviewFallbackText =
    (typeof baseMeta.description === "string" && baseMeta.description.trim()) ||
    `${base.name} operates in the ${displaySector} sector on PSX.`;
  const overviewText =
    (typeof companyMeta?.businessDescription === "string" && companyMeta.businessDescription.trim()) ||
    (typeof companyMeta?.description === "string" && companyMeta.description.trim()) ||
    overviewFallbackText;
  const leadershipItems = useMemo(() => {
    if (!Array.isArray(companyMeta?.keyPeople) || companyMeta.keyPeople.length === 0) return [];
    const normalized = companyMeta.keyPeople
      .map((person) => ({
        name: typeof person?.name === "string" ? person.name.trim() : "",
        position: typeof person?.position === "string" ? person.position.trim() : "",
      }))
      .filter((person) => person.name.length > 0);

    const rolePriority = [
      { match: /(^|\b)ceo(\b|$)|chief executive officer/i, label: "CEO" },
      { match: /chair/i, label: "Chairperson" },
      { match: /secretary/i, label: "Secretary" },
    ] as const;

    const picked: Array<{ role: string; name: string }> = [];
    const used = new Set<number>();

    for (const role of rolePriority) {
      const idx = normalized.findIndex((person, i) => !used.has(i) && role.match.test(person.position));
      if (idx >= 0) {
        used.add(idx);
        picked.push({ role: role.label, name: normalized[idx].name });
      }
    }

    for (let i = 0; i < normalized.length && picked.length < 3; i += 1) {
      if (used.has(i)) continue;
      picked.push({ role: normalized[i].position || "Leadership", name: normalized[i].name });
    }

    return picked.slice(0, 3);
  }, [companyMeta?.keyPeople]);

  useEffect(() => {
    if (!overviewTextRef.current || isOverviewExpanded) {
      setCanExpandOverview(false);
      return;
    }
    const node = overviewTextRef.current;
    setCanExpandOverview(node.scrollHeight > node.clientHeight + 1);
  }, [overviewText, isOverviewExpanded]);
  const foundedText =
    baseMeta.founded != null && `${baseMeta.founded}`.trim().length > 0 ? `${baseMeta.founded}` : null;
  const hqText =
    (typeof baseMeta.hq === "string" && baseMeta.hq.trim()) ||
    (typeof baseMeta.headquarters === "string" && baseMeta.headquarters.trim()) ||
    null;
  const employeesText =
    baseMeta.employees != null && `${baseMeta.employees}`.trim().length > 0
      ? `${baseMeta.employees}`
      : null;
  const websiteText =
    typeof baseMeta.website === "string" && baseMeta.website.trim()
      ? baseMeta.website
      : null;
  const data = fundamentals;
  const parseFiniteNumber = (val: unknown): number | null => {
    if (typeof val === "number" && Number.isFinite(val)) return val;
    if (typeof val === "string") {
      const parsed = Number(val.replace(/,/g, "").trim());
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  const formatCompactValue = (num: number): string => {
    const abs = Math.abs(num);
    if (abs >= 1_000_000_000_000) return `${(num / 1_000_000_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}T`;
    if (abs >= 1_000_000_000) return `${(num / 1_000_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}B`;
    if (abs >= 1_000_000) return `${(num / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`;
    if (abs >= 1_000) return `${(num / 1_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}K`;
    return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
  };
  const formatPercent = (val: unknown, multiplyIfUnderOne: boolean): string | null => {
    const n = parseFiniteNumber(val);
    if (n == null) return null;
    const normalized = multiplyIfUnderOne && Math.abs(n) < 1 ? n * 100 : n;
    return `${normalized.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
  };
  const fundamentalsRows = [
    {
      label: "P/E Ratio",
      value: parseFiniteNumber(data?.peRatio) != null
        ? parseFiniteNumber(data?.peRatio)?.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? null
        : null,
    },
    {
      label: "Dividend Yield",
      value: formatPercent(data?.dividendYield, true),
    },
    {
      label: "Market Cap",
      value: parseFiniteNumber(data?.marketCap) != null
        ? `Rs. ${formatCompactValue(parseFiniteNumber(data?.marketCap) ?? 0)}`
        : null,
    },
    {
      label: "Change %",
      value: formatPercent(data?.changePercent, true),
    },
    {
      label: "1Y Change",
      value: formatPercent(data?.yearChange, true),
    },
    {
      label: "Free Float",
      value: typeof data?.freeFloat === "string" && data.freeFloat.trim().length > 0
        ? data.freeFloat.trim()
        : parseFiniteNumber(data?.freeFloat) != null
          ? formatCompactValue(parseFiniteNumber(data?.freeFloat) ?? 0)
          : null,
    },
    {
      label: "30D Avg Volume",
      value: parseFiniteNumber(data?.volume30Avg) != null
        ? formatCompactValue(parseFiniteNumber(data?.volume30Avg) ?? 0)
        : null,
    },
  ].filter((item) => item.value != null && item.value !== "");
  const stock = {
    open: typeof dayOpen === "number" && Number.isFinite(dayOpen) ? dayOpen : null,
    prevClose: prevClose,
    high: localHigh > 0 ? localHigh : null,
    low: localLow > 0 ? localLow : null,
    volume: hasQuote ? volume : null,
    turnover: turnover,
    avgVolume: averageVolume,
    marketCap: base.marketCap > 0 ? base.marketCap : null,
  };
  const cleanNumericValue = (val: unknown): number | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === "number") return Number.isFinite(val) ? val : null;
    const normalized = String(val)
      .replace(
        /\b(open|prev\s*close|high|low|volume|turnover|avg\s*vol|mkt\s*cap|range)\b/gi,
        ""
      )
      .replace(/\s+/g, " ")
      .trim();
    const cleaned = normalized.replace(/[^\d.-]/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? null : parsed;
  };
  const formatPrice = (val: unknown): string => {
    if (val === null || val === undefined) return "-";
    const num = cleanNumericValue(val);
    if (num === null) return "-";
    return `Rs. ${num.toFixed(2)}`;
  };

  const formatNumber = (val: unknown): string => {
    if (val === null || val === undefined) return "-";
    const num = cleanNumericValue(val);
    if (num === null) return "-";
    const abs = Math.abs(num);
    if (abs >= 1_000_000_000_000) return `${(num / 1_000_000_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}T`;
    if (abs >= 1_000_000_000) return `${(num / 1_000_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}B`;
    if (abs >= 1_000_000) return `${(num / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`;
    if (abs >= 1_000) return `${(num / 1_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}K`;
    return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
  };
  const formatCurrencyCompact = (val: number | null | undefined): string => {
    if (val == null || !Number.isFinite(val)) return NOT_AVAILABLE;
    return `Rs. ${formatNumber(val)}`;
  };
  const formattedOpen = formatPrice(stock?.open);
  const formattedPrevClose = formatPrice(stock?.prevClose);
  const formattedHigh = formatPrice(stock?.high);
  const formattedLow = formatPrice(stock?.low);
  const formattedVolume = formatNumber(stock?.volume);
  const formattedTurnover = formatNumber(stock?.turnover);
  const formattedAvgVol = formatNumber(stock?.avgVolume);
  const formattedMktCap = formatNumber(stock?.marketCap);
  const formattedRange = hasDetailRange
    ? `${formatPrice(rangeLow)} - ${formatPrice(rangeHigh)}`
    : "";
  const dayRangeLow = localLow > 0 ? localLow : null;
  const dayRangeHigh = localHigh > 0 ? localHigh : null;
  const currentRangePrice =
    typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
  const getRangePosition = (
    low: number | null,
    high: number | null,
    current: number | null
  ): number => {
    if (low == null || high == null || current == null || high <= low) return 0;
    const ratio = ((current - low) / (high - low)) * 100;
    return Math.min(100, Math.max(0, ratio));
  };
  const dayRangePosition = getRangePosition(dayRangeLow, dayRangeHigh, currentRangePrice);

  const holding = useMemo(
    () => portfolio.holdings.find((h) => h.ticker === ticker),
    [portfolio.holdings, ticker]
  );

  useEffect(() => {
    const route = `/stock/${ticker}`;
    void logAnalyticsEvent("stock_detail_viewed", { route, ticker });
    void logAnalyticsEvent("trade_ticket_opened", { route, ticker });
  }, [ticker]);

  useEffect(() => {
    setIsOverviewMounted(false);
    setIsOverviewExpanded(false);
    const timer = window.setTimeout(() => setIsOverviewMounted(true), 16);
    return () => window.clearTimeout(timer);
  }, [ticker]);

  useEffect(() => {
    if (activeTab === displayedTab) {
      setIsTabContentVisible(true);
      return;
    }
    setIsTabContentVisible(false);
    const swapTimer = window.setTimeout(() => {
      setDisplayedTab(activeTab);
      window.setTimeout(() => setIsTabContentVisible(true), 16);
    }, 210);
    return () => window.clearTimeout(swapTimer);
  }, [activeTab, displayedTab]);

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
          <div
            className="perch-stock-detail-main"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <section>
              <div
                className="perch-stock-identity"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: COLORS.muted,
                    fontWeight: 700,
                  }}
                >
                  {displaySector}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 76,
                    height: 76,
                    padding: 10,
                    borderRadius: 14,
                    background: "#FFF4EB",
                    border: `1px solid ${ORDER_BORDER}`,
                    flexShrink: 0,
                  }}
                >
                  <StockLogo ticker={base.ticker} size={56} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "baseline",
                      gap: "4px 12px",
                    }}
                  >
                    <h1
                      style={{
                        margin: 0,
                        fontSize: "clamp(20px, 4.2vw, 30px)",
                        fontWeight: 800,
                        lineHeight: 1.1,
                        letterSpacing: "-0.02em",
                        color: COLORS.text,
                      }}
                    >
                      {base.name}
                    </h1>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: COLORS.muted,
                      }}
                    >
                      {base.ticker}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: 18,
                overflow: "hidden",
                background: "linear-gradient(180deg, #FDFDFC 0%, #FAFAF9 100%)",
                boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
              }}
            >
              <div
                className="perch-stock-price-row"
                style={{
                  padding: "10px 18px 4px",
                  borderBottom: `1px solid ${COLORS.border}`,
                }}
              >
                <div>
                  <div style={statLabelStyle()}>Last</div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "baseline",
                      gap: "6px 14px",
                      marginTop: 2,
                    }}
                  >
                    <div
                      className="perch-stock-price-big perch-stock-price-big-stock2"
                      style={{
                        lineHeight: 1,
                        fontWeight: 760,
                        color: COLORS.text,
                      }}
                    >
                      {hasQuote && price != null ? formatPKRWithSymbol(price) : "Awaiting live price"}
                    </div>
                    {hasQuote ? (
                      <span
                        className="perch-fin-number"
                        style={{
                          fontSize: "clamp(15px, 3.4vw, 18px)",
                          fontWeight: 680,
                          color: up ? COLORS.gain : COLORS.loss,
                        }}
                      >
                        {up ? "+" : ""}
                        {change.toFixed(2)} ({up ? "+" : ""}
                        {changePct.toFixed(2)}%)
                      </span>
                    ) : null}
                  </div>
                  <div
                    style={{
                      display: "inline-block",
                      marginTop: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      color: COLORS.muted,
                      background: "rgba(0, 0, 0, 0.04)",
                      padding: "3px 10px",
                      borderRadius: 999,
                    }}
                  >
                    PSX
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: "4px 18px 0",
                }}
              >
                <div className="perch-stock-range-row">
                  {CHART_RANGES.map((item) => {
                    const active = item === range;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setRange(item)}
                        className={`perch-range-btn${active ? " perch-range-btn-active" : ""}`}
                        style={{
                          minHeight: 32,
                          padding: "0 12px",
                          borderRadius: 999,
                          border: active ? `1px solid #AF4300` : `1px solid ${COLORS.border}`,
                          background: active ? "#C45000" : "transparent",
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
              </div>
              <div
                className="perch-stock-chart-box"
                style={{
                  width: "100%",
                  marginTop: 0,
                  paddingLeft: 4,
                  paddingRight: 2,
                  paddingBottom: 2,
                  opacity: chartLoadState === "loading" ? 0.5 : 1,
                  transition: "opacity 180ms ease",
                }}
              >
                <StockPriceLwcChart
                  data={chartData}
                  range={range}
                  lineColor={CHART_LINE}
                  lineColorFaint={CHART_FILL_TOP}
                />
              </div>
            </section>
            <section className="perch-stock-key-stats-section" style={{ marginTop: 10 }}>
              <h2 className="perch-stock-section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BarChart3 className="w-3.5 h-3.5 opacity-80" style={{ color: "#C45000" }} />
                <span>Key Stats</span>
              </h2>

              <div className="perch-stock-key-stats-grid">
                <div className="perch-stock-key-stat-item">
                  <span className="perch-stock-key-stat-label">Open</span>
                  <span className="perch-stock-key-stat-value">{formattedOpen}</span>
                </div>
                <div className="perch-stock-key-stat-item">
                  <span className="perch-stock-key-stat-label">Prev close</span>
                  <span className="perch-stock-key-stat-value">{formattedPrevClose}</span>
                </div>
                <div className="perch-stock-key-stat-item">
                  <span className="perch-stock-key-stat-label">High</span>
                  <span className="perch-stock-key-stat-value">{formattedHigh}</span>
                </div>
                <div className="perch-stock-key-stat-item">
                  <span className="perch-stock-key-stat-label">Low</span>
                  <span className="perch-stock-key-stat-value">{formattedLow}</span>
                </div>
                <div className="perch-stock-key-stat-item">
                  <span className="perch-stock-key-stat-label">Volume</span>
                  <span className="perch-stock-key-stat-value">{formattedVolume}</span>
                </div>
                <div className="perch-stock-key-stat-item">
                  <span className="perch-stock-key-stat-label">Turnover</span>
                  <span className="perch-stock-key-stat-value">{formattedTurnover}</span>
                </div>
                <div className="perch-stock-key-stat-item">
                  <span className="perch-stock-key-stat-label">Avg vol</span>
                  <span className="perch-stock-key-stat-value">{formattedAvgVol}</span>
                </div>
                <div className="perch-stock-key-stat-item">
                  <span className="perch-stock-key-stat-label">Mkt cap</span>
                  <span className="perch-stock-key-stat-value">{formattedMktCap}</span>
                </div>
                {formattedRange ? (
                  <div className="perch-stock-key-stat-item">
                    <span className="perch-stock-key-stat-label">Range</span>
                    <span className="perch-stock-key-stat-value">{formattedRange}</span>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="perch-stock-overview-section" style={{ marginTop: 10 }}>
              <div className={styles.tabRail} role="tablist" aria-label="Stock detail sections">
                <div className={styles.tabRailLine} aria-hidden="true" />
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "overview"}
                  className={`${styles.tabButton}${activeTab === "overview" ? ` ${styles.tabButtonActive}` : ""}`}
                  onClick={() => setActiveTab("overview")}
                >
                  Overview
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "fundamentals"}
                  className={`${styles.tabButton}${activeTab === "fundamentals" ? ` ${styles.tabButtonActive}` : ""}`}
                  onClick={() => setActiveTab("fundamentals")}
                >
                  Fundamentals
                </button>
              </div>

              <div
                className={`${styles.tabContent}${isTabContentVisible ? ` ${styles.tabContentVisible}` : ` ${styles.tabContentHidden}`}`}
              >
                {displayedTab === "overview" ? (
                  <>
                    <h2 className="perch-stock-section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <FileText className="w-3.5 h-3.5 opacity-80" style={{ color: "#C45000" }} />
                      <span>Overview</span>
                    </h2>
                    <div
                      style={{
                        marginTop: 6,
                        height: 2,
                        maxWidth: 240,
                        width: isOverviewMounted ? "100%" : 0,
                        borderRadius: 999,
                        background: "linear-gradient(90deg, rgba(196,80,0,0.96) 0%, rgba(196,80,0,0.16) 100%)",
                        transition: "width 240ms ease",
                      }}
                    />
                    <p
                      ref={overviewTextRef}
                      className="perch-stock-overview-text"
                      style={{
                        marginTop: 10,
                        maxWidth: 860,
                        lineHeight: 1.72,
                        opacity: isOverviewMounted ? 1 : 0,
                        transform: isOverviewMounted ? "translateY(0)" : "translateY(4px)",
                        transition: "opacity 220ms ease 50ms, transform 220ms ease 50ms",
                        ...(isOverviewExpanded
                          ? {}
                          : {
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }),
                      }}
                    >
                      {overviewText}
                    </p>
                    {canExpandOverview ? (
                      <button
                        type="button"
                        onClick={() => setIsOverviewExpanded((current) => !current)}
                        style={{
                          marginTop: 6,
                          padding: 0,
                          border: "none",
                          background: "transparent",
                          color: COLORS.orange,
                          fontSize: 12.5,
                          fontWeight: 650,
                          letterSpacing: "0.01em",
                          cursor: "pointer",
                        }}
                      >
                        {isOverviewExpanded ? "Read less" : "Read more"}
                      </button>
                    ) : null}
                    {leadershipItems.length > 0 ? (
                      <p
                        className="perch-stock-overview-text"
                        style={{
                          marginTop: 8,
                          color: COLORS.muted,
                          fontSize: 13,
                          lineHeight: 1.45,
                          opacity: isOverviewMounted ? 1 : 0,
                          transform: isOverviewMounted ? "translateY(0)" : "translateY(4px)",
                          transition: "opacity 220ms ease 100ms, transform 220ms ease 100ms",
                        }}
                      >
                        {leadershipItems.map((item, idx) => (
                          <span key={`${item.role}-${item.name}-${idx}`}>
                            <span
                              style={{
                                color: COLORS.orange,
                                fontSize: 11,
                                fontWeight: 650,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                              }}
                            >
                              {item.role}
                            </span>{" "}
                            <span style={{ color: COLORS.text, fontWeight: 500 }}>{item.name}</span>
                            {idx < leadershipItems.length - 1 ? (
                              <span style={{ color: COLORS.mutedSoft, margin: "0 8px" }} aria-hidden="true">
                                ·
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </p>
                    ) : null}
                    <div className="perch-stock-meta-row">
                      {foundedText ? <span className="perch-stock-meta-item">Founded {foundedText}</span> : null}
                      {hqText ? <span className="perch-stock-meta-item">HQ {hqText}</span> : null}
                      {employeesText ? <span className="perch-stock-meta-item">Employees {employeesText}</span> : null}
                      {websiteText ? <span className="perch-stock-meta-item">Website {websiteText}</span> : null}
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="perch-stock-section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <BarChart3 className="w-3.5 h-3.5 opacity-80" style={{ color: "#C45000" }} />
                      <span>Fundamentals</span>
                    </h2>
                    {fundamentalsLoading ? (
                      <p
                        className="perch-stock-overview-text"
                        style={{ marginTop: 10, color: COLORS.muted, fontSize: 13, lineHeight: 1.45 }}
                      >
                        Loading fundamentals...
                      </p>
                    ) : null}
                    {!fundamentalsLoading && fundamentalsRows.length > 0 ? (
                      <div className={styles.fundamentalsGrid}>
                        {fundamentalsRows.map((item) => (
                          <div key={item.label} className={styles.fundamentalsItem}>
                            <span className={styles.fundamentalsLabel}>{item.label}</span>
                            <span className={styles.fundamentalsValue}>{item.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </section>
          </div>

          <aside
            className="perch-stock-order-aside"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              width: "100%",
              maxWidth: 332,
              justifySelf: "end",
            }}
          >
            <div
              style={{
                border: `1px solid ${ORDER_BORDER}`,
                borderRadius: 12,
                background: "#FFFFFF",
                padding: "10px 11px",
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 11, color: COLORS.mutedSoft, fontWeight: 600, letterSpacing: "0.03em" }}>
                DAY RANGE
              </div>
              <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <span className="perch-fin-number" style={{ fontSize: 14, fontWeight: 620, color: COLORS.text }}>
                  {dayRangeLow != null ? formatPKRWithSymbol(dayRangeLow) : "-"}
                </span>
                <span className="perch-fin-number" style={{ fontSize: 14, fontWeight: 620, color: COLORS.text }}>
                  {dayRangeHigh != null ? formatPKRWithSymbol(dayRangeHigh) : "-"}
                </span>
              </div>
              <div style={{ marginTop: 1, display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 10.5, color: COLORS.mutedSoft }}>Low</span>
                <span style={{ fontSize: 10.5, color: COLORS.mutedSoft }}>High</span>
              </div>
              <div
                style={{
                  marginTop: 8,
                  position: "relative",
                  width: "100%",
                  height: 6,
                  borderRadius: 999,
                  background: "#E5E5E5",
                  overflow: "visible",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${dayRangePosition}%`,
                    borderRadius: 999,
                    background: COLORS.orange,
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: `${dayRangePosition}%`,
                    top: "50%",
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: "#3F3A36",
                    transform: "translate(-50%, -50%)",
                  }}
                />
              </div>
            </div>
            <div
              style={{
                border: `1px solid ${ORDER_BORDER}`,
                borderRadius: 16,
                background: PANEL_TINT,
                padding: "clamp(12px, 3.2vw, 16px)",
                boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ ...statLabelStyle(), color: COLORS.muted, letterSpacing: "0.1em" }}>
                Order ticket
              </div>
              <div className="perch-fin-number" style={{ marginTop: 3, fontSize: 17, fontWeight: 750, color: COLORS.text }}>
                {base.ticker}
              </div>
              <div style={{ marginTop: 1, fontSize: 12.5, color: COLORS.muted, lineHeight: 1.35, fontWeight: 500 }}>
                {base.name}
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "#8B8682", fontWeight: 600, letterSpacing: "0.01em" }}>
                  Buying power
                </div>
                <div className="perch-fin-number" style={{ marginTop: 2, fontSize: 19, fontWeight: 650, color: "#C45000" }}>
                  {formatCurrencyCompact(portfolio.cash)}
                </div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 0,
                  borderRadius: 8,
                  background: "#F4F2EF",
                  padding: 2,
                }}
              >
                <button
                  type="button"
                  onClick={() => setMode("BUY")}
                  style={{
                    flex: 1,
                    minHeight: 34,
                    borderRadius: 6,
                    border: "none",
                    background: mode === "BUY" ? "#C45000" : "transparent",
                    color: mode === "BUY" ? "#FFFFFF" : "#6F6C68",
                    fontWeight: 600,
                    letterSpacing: "0.01em",
                    fontSize: 14,
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
                    minHeight: 34,
                    borderRadius: 6,
                    border: "none",
                    background: mode === "SELL" ? COLORS.loss : "transparent",
                    color: mode === "SELL" ? "#FFFFFF" : "#6F6C68",
                    fontWeight: 600,
                    letterSpacing: "0.01em",
                    fontSize: 14,
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  Sell
                </button>
              </div>

              <div style={{ marginTop: 11 }}>
                <div style={{ fontSize: 12, color: "#6F6C68", fontWeight: 500 }}>
                  Order type
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: "#6F6C68", fontWeight: 500 }}>
                  Market order
                </div>
              </div>

              <div style={{ marginTop: 11 }}>
                <div style={{ ...statLabelStyle(), color: COLORS.muted, letterSpacing: "0.1em" }}>
                  Quantity
                </div>
                <div style={{ position: "relative", marginTop: 6 }}>
                  <input
                    inputMode="numeric"
                    value={sharesInput}
                    onChange={(e) => setSharesInput(e.target.value)}
                    className="perch-ticket-shares-input"
                    style={{
                      width: "100%",
                      minHeight: 42,
                      borderRadius: 8,
                      border: "1px solid #E8E4DF",
                      padding: "0 60px 0 14px",
                      fontSize: 15,
                      outline: "none",
                      color: COLORS.text,
                      background: "#FFFFFF",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = COLORS.orange;
                      e.currentTarget.style.boxShadow = "0 0 0 2px rgba(196,80,0,0.1)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = COLORS.border;
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: COLORS.mutedSoft, fontWeight: 600 }}>
                    Shares
                  </span>
                </div>
                <div style={{ marginTop: 7, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
                  {[10, 50, 100, 500].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSharesInput(String(preset))}
                      style={{
                        minHeight: 28,
                        borderRadius: 6,
                        border: "1px solid #E8E4DF",
                        background: "#FFFFFF",
                        color: "#6F6C68",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#F4F2EF";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#FFFFFF";
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  marginTop: 11,
                  background: "rgba(255,255,255,0.72)",
                  border: `1px solid ${ORDER_BORDER}`,
                  borderRadius: 10,
                  padding: "10px 11px",
                  fontSize: 13,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                  <div className="perch-ticket-label" style={{ color: "#8B8682", fontWeight: 600 }}>
                    Estimated amount
                  </div>
                  <div className="perch-fin-number" style={{ fontWeight: 650, color: "#1F1F1F", fontSize: 14 }}>
                    {hasQuote ? formatCurrencyCompact(est) : NOT_AVAILABLE}
                  </div>
                </div>
                <div className="perch-fin-number" style={{ marginTop: 5, color: COLORS.mutedSoft, fontSize: 12.5 }}>
                  {hasQuote ? `${formatPrice(estimatedExecutionPrice)} per share` : NOT_AVAILABLE}
                </div>
              </div>

              {message && (
                <div
                  style={{
                    marginTop: 10,
                    border: `1px solid ${message.includes("Bought") || message.includes("Sold") ? "#CFE6DB" : "#F0D1CC"}`,
                    background:
                      message.includes("Bought") || message.includes("Sold")
                        ? "#F4FBF7"
                        : "#FFF6F4",
                    color:
                      message.includes("Bought") || message.includes("Sold")
                        ? COLORS.gain
                        : COLORS.loss,
                    borderRadius: 9,
                    padding: "8px 11px",
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
                        marginTop: 12,
                        width: "100%",
                        minHeight: 44,
                        borderRadius: 8,
                        border: `1px solid ${COLORS.orange}`,
                        background: "#C45000",
                        color: "#FFFFFF",
                        fontWeight: 650,
                        fontSize: 15,
                        letterSpacing: "0.02em",
                        boxShadow: "0 4px 14px rgba(196,80,0,0.2)",
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
                        marginTop: 12,
                        width: "100%",
                        minHeight: 44,
                        borderRadius: 8,
                        border: `1px solid ${COLORS.loss}`,
                        background: "#FFFFFF",
                        color: COLORS.loss,
                        fontWeight: 650,
                        fontSize: 15,
                        letterSpacing: "0.02em",
                        cursor: isSubmitting || !hasQuote ? "not-allowed" : "pointer",
                        opacity: isSubmitting || !hasQuote ? 0.55 : 1,
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      {isSubmitting ? "Confirming order..." : `Sell ${ticker}`}
                    </button>
                  )}

              <button
                type="button"
                style={{
                  marginTop: 8,
                  width: "100%",
                  minHeight: 38,
                  borderRadius: 8,
                  border: "1px solid #E8E4DF",
                  background: "#FFFFFF",
                  color: "#6F6C68",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Add to Watchlist
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
