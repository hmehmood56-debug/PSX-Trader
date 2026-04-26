"use client";

import { useRouter } from "next/navigation";
import { startRouteProgress } from "@/lib/routeProgress";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLivePrices, type ReplayStock } from "@/lib/priceSimulator";
import { formatCompactPKR, formatPKRWithSymbol } from "@/lib/format";
import { getDisplaySectorForTicker } from "@/lib/psxSymbolMetadata";
import { TICKER_DOMAIN_MAP } from "@/lib/tickerDomainMap";
import { StockLogo } from "@/components/common/StockLogo";
import { ChartLine, ChartLineUp, TrendDown } from "phosphor-react";
import { Circle } from "lucide-react";
import styles from "./SimulatedPsxExperience.module.css";

const COLORS = {
  orange: "#EA580C",
  bg: "#FAFAFA",
  bgSecondary: "#F7F7F7",
  border: "#E8E8E8",
  text: "#1A1A1A",
  muted: "#6B6B6B",
  mutedSoft: "#8A8A8A",
  gain: "#007A4C",
  loss: "#C0392B",
} as const;

function SearchHero({
  q,
  setQ,
  sector,
  setSector,
  sectors,
  sessionState,
}: {
  q: string;
  setQ: (value: string) => void;
  sector: string;
  setSector: (value: string) => void;
  sectors: string[];
  sessionState: string;
}) {
  const isLive = sessionState === "live";
  return (
    <section
      style={{
        padding: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 24 }}>
            {isLive ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 999,
                  background: "#e8f3ec",
                  color: "#2f5d42",
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 500,
                  lineHeight: 1,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: 999, background: "#4b8a63", display: "inline-block" }} />
                Live Market
              </span>
            ) : null}
          </div>
          <h1
            style={{
              margin: "6px 0 0",
              fontSize: "clamp(19px, 3.8vw, 22px)",
              fontWeight: 600,
              color: "#262626",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                width: 3,
                height: 18,
                borderRadius: 3,
                background: COLORS.orange,
                display: "inline-block",
              }}
            />
            Pakistan Stock Exchange
          </h1>
          <p style={{ marginTop: 6, marginBottom: 0, color: "#737373", fontSize: 13, lineHeight: "18px", maxWidth: 780 }}>
            Live Pakistan market data for screening and discovery.
          </p>
        </div>
      </div>

      <div className="perch-psx-search-grid" style={{ marginTop: 10 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search PSX stocks (e.g. OGDC, HBL)"
          aria-label="Search ticker or company"
          style={{
            width: "100%",
            height: 48,
            borderRadius: 12,
            border: "1px solid #e5e5e5",
            padding: "0 18px",
            fontSize: 15,
            outline: "none",
            background: "#FFFFFF",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = COLORS.orange;
            e.currentTarget.style.boxShadow = "0 0 0 1px rgba(234,88,12,0.35)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#e5e5e5";
            e.currentTarget.style.boxShadow = "none";
          }}
        />

        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          aria-label="Filter by sector"
          style={{
            width: "100%",
            height: 48,
            borderRadius: 12,
            border: "1px solid #e5e5e5",
            padding: "0 14px",
            fontSize: 15,
            outline: "none",
            background: "#FFFFFF",
          }}
        >
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}

const SEARCH_RESULTS_MAX = 25;

function SearchResultsSection({
  stocks,
  query,
  onOpen,
}: {
  stocks: Array<ReplayStock & { displaySector: string }>;
  query: string;
  onOpen: (ticker: string) => void;
}) {
  const qTrim = query.trim();
  const total = stocks.length;
  const visible = stocks.slice(0, SEARCH_RESULTS_MAX);
  const showCapLine = total > SEARCH_RESULTS_MAX;

  return (
    <section style={{ marginTop: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "clamp(16px, 3.4vw, 18px)",
            color: COLORS.text,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              width: 3,
              height: 16,
              borderRadius: 3,
              background: COLORS.orange,
              display: "inline-block",
            }}
          />
          Matching listings
        </h2>
        {total > 0 ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: COLORS.muted,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {total} {total === 1 ? "listing" : "listings"}
          </span>
        ) : null}
      </div>
      {qTrim ? (
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 12,
            color: COLORS.muted,
            lineHeight: 1.4,
            maxWidth: 720,
          }}
        >
          Search: <span style={{ color: COLORS.text, fontWeight: 600 }}>&ldquo;{qTrim}&rdquo;</span>
        </p>
      ) : null}
      {total === 0 ? (
        <div
          style={{
            marginTop: 12,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 14,
            background: "#FFFFFF",
            boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
            padding: 0,
            display: "grid",
            gridTemplateColumns: "4px 1fr",
            gap: 0,
            overflow: "hidden",
          }}
        >
          <span style={{ background: `linear-gradient(180deg, ${COLORS.orange} 0%, #f59e0b 100%)` }} />
          <div style={{ padding: "20px 18px" }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: COLORS.text, letterSpacing: "-0.01em" }}>
              No matching PSX listing found.
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
              Try another ticker, company name, or choose a different sector to widen results.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {visible.map((stock) => {
              const up = stock.hasLiveQuote && stock.change >= 0;
              return (
                <button
                  key={stock.ticker}
                  type="button"
                  onClick={() => onOpen(stock.ticker)}
                  style={{
                    textAlign: "left",
                    width: "100%",
                    minHeight: 56,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 12,
                    background: "#FEFEFC",
                    cursor: "pointer",
                    padding: 0,
                    display: "grid",
                    gridTemplateColumns: "4px 1fr",
                    gap: 0,
                    overflow: "hidden",
                    boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span style={{ background: COLORS.orange, minHeight: "100%" }} />
                  <div
                    style={{
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div style={{ minWidth: 0, flex: "1 1 160px" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, letterSpacing: "-0.01em" }}>{stock.ticker}</div>
                        <div
                          style={{
                            marginTop: 2,
                            color: COLORS.muted,
                            fontSize: 12.5,
                            lineHeight: "16px",
                          }}
                        >
                          {stock.name}
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            color: COLORS.mutedSoft,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {stock.displaySector.replace(/_/g, " ")}
                        </div>
                      </div>
                      <div
                        style={{
                          textAlign: "right",
                          flexShrink: 0,
                          fontVariantNumeric: "tabular-nums",
                          minWidth: 0,
                        }}
                      >
                        {stock.hasLiveQuote ? (
                          <>
                            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>{formatPKRWithSymbol(stock.price)}</div>
                            <div
                              style={{
                                marginTop: 2,
                                fontSize: 13,
                                fontWeight: 700,
                                color: up ? COLORS.gain : COLORS.loss,
                              }}
                            >
                              {up ? "+" : ""}
                              {stock.changePercent.toFixed(2)}%
                            </div>
                            <div style={{ marginTop: 4, color: COLORS.muted, fontSize: 12, fontWeight: 500 }}>
                              Vol {formatCompactPKR(stock.volume)}
                            </div>
                          </>
                        ) : (
                          <div
                            style={{
                              maxWidth: 200,
                              marginLeft: "auto",
                              fontSize: 12.5,
                              fontStyle: "italic",
                              color: COLORS.muted,
                              lineHeight: 1.4,
                            }}
                          >
                            No live quote yet
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {showCapLine ? (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 12,
                color: COLORS.muted,
                lineHeight: 1.4,
              }}
            >
              Showing {SEARCH_RESULTS_MAX} of {total} matches
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

const MARKET_TABS = ["trending", "foreign-activity"] as const;
type MarketTab = (typeof MARKET_TABS)[number];

type ForeignActivityData = {
  sessionDate: string;
  updatedAt: string;
  sourceName: "NCCPL";
  sourceUrl: "https://beta.nccpl.com.pk/market-information";
  foreignBuy: number;
  foreignSell: number;
  foreignNet: number;
  currency: "PKR";
  sectors: Array<{
    sector: string;
    buy: number;
    sell: number;
    net: number;
    totalActivity: number;
    direction: "inflow" | "outflow" | "flat";
  }>;
};

function MarketTickerTape({
  items,
  onOpen,
}: {
  items: ReplayStock[];
  onOpen: (ticker: string) => void;
}) {
  const tape = [...items, ...items];

  return (
    <section
      style={{
        marginTop: 16,
        border: "1px solid rgba(20, 10, 5, 0.38)",
        borderRadius: 9,
        overflow: "hidden",
        background: "linear-gradient(132deg, #693320 0%, #74402a 48%, #663220 100%)",
        boxShadow: "inset 0 1px 0 rgba(255, 242, 232, 0.14), inset 0 -1px 0 rgba(43, 21, 12, 0.35)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "linear-gradient(180deg, rgba(255,240,228,0.08) 0%, rgba(255,240,228,0.02) 24%, rgba(0,0,0,0) 64%)",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          minHeight: 52,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 12px",
            minHeight: 52,
            borderRight: "1px solid rgba(255, 225, 201, 0.16)",
          }}
        >
          <Circle size={7} fill="#d4efe0" color="#d4efe0" />
          <span
            style={{
              color: "#f8e9dd",
              fontSize: 10,
              letterSpacing: "0.08em",
              fontWeight: 700,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            Live PSX Ticker
          </span>
        </div>
        <div
          className="perch-ticker-row"
          style={{
            flex: 1,
            minWidth: 0,
            whiteSpace: "nowrap",
            background: "transparent",
          }}
        >
        <div className="perch-ticker-track" style={{ animationDuration: "58s", animationTimingFunction: "linear" }}>
          {tape.map((s, idx) => {
            const up = s.hasLiveQuote && s.change >= 0;
            return (
              <button
                key={`${s.ticker}-${idx}`}
                type="button"
                onClick={() => onOpen(s.ticker)}
                style={{
                  minHeight: 52,
                  padding: "0 14px 0 15px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  borderRight: "1px solid rgba(255, 229, 210, 0.1)",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span style={{ color: "#fff0e3", fontWeight: 700, fontSize: 13.5, letterSpacing: "0.01em" }}>{s.ticker}</span>
                <span style={{ color: "#f3dfcf", fontVariantNumeric: "tabular-nums", fontSize: 12.5, fontWeight: 500 }}>
                  {s.hasLiveQuote ? formatPKRWithSymbol(s.price) : "—"}
                </span>
                <span
                  style={{
                    color: s.hasLiveQuote ? (up ? "#8fc5a7" : "#d9a09a") : "#d5b9a7",
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 11.5,
                  }}
                >
                  {s.hasLiveQuote ? (
                    <>
                      {up ? "+" : ""}
                      {s.changePercent.toFixed(2)}%
                    </>
                  ) : (
                    "—"
                  )}
                </span>
              </button>
            );
          })}
        </div>
        </div>
      </div>
    </section>
  );
}
export function SimulatedPsxExperience() {
  const router = useRouter();
  const { getStocksWithLive, getMarketSnapshot } = useLivePrices();
  const allStocks = getStocksWithLive();
  const stocks = useMemo(
    () =>
      allStocks
        .filter((stock) => stock.ticker.length > 0)
        .map((stock) => ({
          ...stock,
          displaySector: getDisplaySectorForTicker(stock.ticker, stock.sector),
        })),
    [allStocks]
  );
  const market = getMarketSnapshot();
  const sectors = useMemo(
    () => ["All", ...Array.from(new Set(stocks.map((s) => s.displaySector))).sort((a, b) => a.localeCompare(b))],
    [stocks]
  );

  const [q, setQ] = useState("");
  const [sector, setSector] = useState("All");
  const [activeTab, setActiveTab] = useState<MarketTab>("trending");
  const [displayedTab, setDisplayedTab] = useState<MarketTab>("trending");
  const [isTabContentVisible, setIsTabContentVisible] = useState(true);
  const [isTabRailPinned, setIsTabRailPinned] = useState(false);
  const [foreignActivity, setForeignActivity] = useState<ForeignActivityData | null>(null);
  const tabShellRef = useRef<HTMLElement | null>(null);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return stocks.filter((s) => {
      const secOk = sector === "All" || s.displaySector === sector;
      const textOk =
        !term ||
        s.ticker.toLowerCase().includes(term) ||
        s.name.toLowerCase().includes(term);
      return secOk && textOk;
    });
  }, [stocks, q, sector]);

  const globalLive = useMemo(
    () => stocks.filter((s) => s.hasLiveQuote),
    [stocks]
  );
  const mostActive = useMemo(
    () => [...globalLive].sort((a, b) => b.volume - a.volume)[0] ?? null,
    [globalLive]
  );
  const topGainer = useMemo(
    () => [...globalLive].sort((a, b) => b.changePercent - a.changePercent)[0] ?? null,
    [globalLive]
  );
  const topLoser = useMemo(
    () => [...globalLive].sort((a, b) => a.changePercent - b.changePercent)[0] ?? null,
    [globalLive]
  );
  const marketSentiment = useMemo((): "Bullish" | "Neutral" | "Bearish" => {
    const b = market.marketBreadth;
    if (b >= 0.58) return "Bullish";
    if (b <= 0.42) return "Bearish";
    return "Neutral";
  }, [market.marketBreadth]);

  const trendingNow = useMemo(
    () =>
      [...filtered]
        .filter((s) => s.hasLiveQuote)
        .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
        .slice(0, 4),
    [filtered]
  );

  const marketTape = useMemo(
    () =>
      [...globalLive]
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 80),
    [globalLive]
  );
  const sectorLeadership = useMemo(() => {
    const leaders = (market.sectorLeaders ?? []).slice(0, 2).map((s) => s.sector.replace("_", " "));
    return leaders.length > 0 ? leaders.join(" / ") : "N/A";
  }, [market.sectorLeaders]);

  const isSearching = q.trim().length > 0 || sector !== "All";
  const activeTabIndex = MARKET_TABS.indexOf(activeTab);
  const marketBreadthPercent = Math.round(Math.max(0, Math.min(1, market.marketBreadth)) * 100);
  const logoBaseConfigured = typeof process.env.NEXT_PUBLIC_LOGO_BASE === "string" && process.env.NEXT_PUBLIC_LOGO_BASE.trim().length > 0;

  const shouldRenderTickerTextNextToLogo = (ticker: string) => {
    const normalized = ticker.trim().toUpperCase();
    return logoBaseConfigured && Boolean(TICKER_DOMAIN_MAP[normalized]);
  };

  useEffect(() => {
    if (activeTab === displayedTab) {
      setIsTabContentVisible(true);
      return;
    }
    setIsTabContentVisible(false);
    const swapTimer = window.setTimeout(() => {
      setDisplayedTab(activeTab);
      window.setTimeout(() => setIsTabContentVisible(true), 16);
    }, 260);
    return () => window.clearTimeout(swapTimer);
  }, [activeTab, displayedTab]);

  useEffect(() => {
    const syncPinnedState = () => {
      const top = tabShellRef.current?.getBoundingClientRect().top;
      setIsTabRailPinned(typeof top === "number" && top <= 11);
    };
    syncPinnedState();
    window.addEventListener("scroll", syncPinnedState, { passive: true });
    window.addEventListener("resize", syncPinnedState);
    return () => {
      window.removeEventListener("scroll", syncPinnedState);
      window.removeEventListener("resize", syncPinnedState);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadForeignActivity = async () => {
      try {
        const res = await fetch("/data/nccpl/foreign-investor-activity.latest.json", {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) {
            setForeignActivity(null);
          }
          return;
        }
        const parsed = (await res.json()) as ForeignActivityData;
        if (!cancelled) {
          setForeignActivity(parsed);
        }
      } catch {
        if (!cancelled) {
          setForeignActivity(null);
        }
      }
    };
    void loadForeignActivity();
    return () => {
      cancelled = true;
    };
  }, []);

  const openStock = (ticker: string) => {
    startRouteProgress();
    router.push(`/stock/${ticker}`);
  };

  const formatCompactPkr = (value: number) => {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1_000_000_000) {
      return `${sign}Rs. ${(abs / 1_000_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}B`;
    }
    if (abs >= 1_000_000) {
      return `${sign}Rs. ${(abs / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
    }
    if (abs >= 1_000) {
      return `${sign}Rs. ${(abs / 1_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`;
    }
    return `${sign}Rs. ${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  };

  const netValueColor = (value: number) =>
    value > 0 ? "#2f7a56" : value < 0 ? "#b74c42" : COLORS.text;

  const formatDirection = (direction: "inflow" | "outflow" | "flat") => {
    if (direction === "inflow") return "Inflow";
    if (direction === "outflow") return "Outflow";
    return "Flat";
  };

  return (
    <div style={{ background: COLORS.bg }}>
      <div className="perch-shell perch-shell-wide perch-psx-shell">
        <SearchHero
          q={q}
          setQ={setQ}
          sector={sector}
          setSector={setSector}
          sectors={sectors}
          sessionState={market.sessionState}
        />

        <MarketTickerTape items={marketTape} onOpen={(ticker) => router.push(`/stock/${ticker}`)} />

        {stocks.length === 0 ? (
          <div
            style={{
              marginTop: 20,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 14,
              padding: 24,
              textAlign: "center",
              color: COLORS.muted,
            }}
          >
            No PSX listings match your current filters.
          </div>
        ) : (
          <>
            {isSearching ? (
              <SearchResultsSection stocks={filtered} query={q} onOpen={openStock} />
            ) : (
              <section
                ref={tabShellRef}
                className={`${styles.premiumTabsShell}${isTabRailPinned ? ` ${styles.premiumTabsShellPinned}` : ""}`}
                style={{ marginTop: 14 }}
              >
                <div className={styles.premiumTabsRail} role="tablist" aria-label="Market overview sections">
                  <div className={styles.premiumTabsTrack} aria-hidden="true" />
                  <div
                    className={styles.premiumTabsIndicator}
                    style={{ transform: `translateX(${activeTabIndex * 100}%)` }}
                    aria-hidden="true"
                  />
                  {MARKET_TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab}
                      className={`${styles.premiumTabButton}${activeTab === tab ? ` ${styles.premiumTabButtonActive}` : ""}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab === "trending" ? "Trending" : "Foreign Activity"}
                    </button>
                  ))}
                </div>

                <div
                  className={`${styles.tabContent}${isTabContentVisible ? ` ${styles.tabContentVisible}` : ` ${styles.tabContentHidden}`}`}
                >
                  {displayedTab === "trending" ? (
                    <div className={styles.trendingLayout}>
                      <div className={styles.metricGridPrimary}>
                        <div className={styles.metricItem}>
                          <div
                            style={{
                              fontSize: 10,
                              color: COLORS.mutedSoft,
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              fontWeight: 650,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <ChartLine size={17} weight="duotone" color="#C45000" />
                            Most Active
                          </div>
                          <div
                            aria-hidden="true"
                            style={{
                              marginTop: 4,
                              width: 36,
                              height: 1,
                              borderRadius: 999,
                              background: "linear-gradient(90deg, rgba(196, 80, 0, 0.62), rgba(196, 80, 0, 0.1))",
                            }}
                          />
                          <div
                            className={styles.metricValue}
                            style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 7 }}
                          >
                            {mostActive ? (
                              <>
                                <StockLogo ticker={mostActive.ticker} size={15} />
                                {shouldRenderTickerTextNextToLogo(mostActive.ticker) ? <span>{mostActive.ticker}</span> : null}
                              </>
                            ) : (
                              <span>N/A</span>
                            )}
                          </div>
                          <div className={styles.metricSecondary}>{mostActive ? `Vol ${formatCompactPKR(mostActive.volume)}` : "No live volume"}</div>
                        </div>
                        <div className={styles.metricItem}>
                          <div
                            style={{
                              fontSize: 10,
                              color: COLORS.mutedSoft,
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              fontWeight: 650,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <ChartLineUp size={17} weight="duotone" color="#C45000" />
                            Top Gainer
                          </div>
                          <div
                            aria-hidden="true"
                            style={{
                              marginTop: 4,
                              width: 36,
                              height: 1,
                              borderRadius: 999,
                              background: "linear-gradient(90deg, rgba(196, 80, 0, 0.62), rgba(196, 80, 0, 0.1))",
                            }}
                          />
                          <div
                            className={styles.metricValue}
                            style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 7 }}
                          >
                            {topGainer ? (
                              <>
                                <StockLogo ticker={topGainer.ticker} size={15} />
                                {shouldRenderTickerTextNextToLogo(topGainer.ticker) ? <span>{topGainer.ticker}</span> : null}
                              </>
                            ) : (
                              <span>N/A</span>
                            )}
                          </div>
                          <div className={`${styles.metricSecondary} ${styles.metricPositive}`}>
                            {topGainer ? `+${topGainer.changePercent.toFixed(2)}%` : "No gainers"}
                          </div>
                        </div>
                        <div className={styles.metricItem}>
                          <div
                            style={{
                              fontSize: 10,
                              color: COLORS.mutedSoft,
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              fontWeight: 650,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <TrendDown size={17} weight="duotone" color="#C45000" />
                            Top Loser
                          </div>
                          <div
                            aria-hidden="true"
                            style={{
                              marginTop: 4,
                              width: 36,
                              height: 1,
                              borderRadius: 999,
                              background: "linear-gradient(90deg, rgba(196, 80, 0, 0.62), rgba(196, 80, 0, 0.1))",
                            }}
                          />
                          <div
                            className={styles.metricValue}
                            style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 7 }}
                          >
                            {topLoser ? (
                              <>
                                <StockLogo ticker={topLoser.ticker} size={15} />
                                {shouldRenderTickerTextNextToLogo(topLoser.ticker) ? <span>{topLoser.ticker}</span> : null}
                              </>
                            ) : (
                              <span>N/A</span>
                            )}
                          </div>
                          <div className={`${styles.metricSecondary} ${styles.metricNegative}`}>
                            {topLoser ? `${topLoser.changePercent.toFixed(2)}%` : "No losers"}
                          </div>
                        </div>
                        <div className={styles.metricItem}>
                          <div style={{ fontSize: 10, color: COLORS.mutedSoft, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 650 }}>
                            Sentiment
                          </div>
                          <div
                            aria-hidden="true"
                            style={{
                              marginTop: 4,
                              width: 36,
                              height: 1,
                              borderRadius: 999,
                              background: "linear-gradient(90deg, rgba(196, 80, 0, 0.62), rgba(196, 80, 0, 0.1))",
                            }}
                          />
                          <div className={styles.metricValue}>{marketSentiment}</div>
                          <div className={styles.metricSecondary}>{marketBreadthPercent}% Advancers</div>
                        </div>
                      </div>

                      <div className={styles.metricGridSecondary}>
                        <div className={styles.metricItem}>
                          <div className={styles.metricLabel}>Breadth</div>
                          <div className={styles.metricValue}>{marketBreadthPercent}% Advancers</div>
                          <div className={styles.metricSecondary}>{marketSentiment}</div>
                        </div>
                        <div className={styles.metricItem}>
                          <div className={styles.metricLabel}>Turnover Est.</div>
                          <div className={styles.metricValue}>{formatCompactPKR(market.turnoverEstimate)}</div>
                          <div className={styles.metricSecondary}>Session estimate</div>
                        </div>
                        <div className={styles.metricItem}>
                          <div className={styles.metricLabel}>Sector Leadership</div>
                          <div className={styles.metricValue}>{sectorLeadership}</div>
                          <div className={styles.metricSecondary}>Top moving sectors</div>
                        </div>
                      </div>

                      <div className={styles.trendingBlock}>
                        <div className={styles.trendingHeading}>Trending Now</div>
                        <div className={styles.trendingGrid}>
                          {trendingNow.map((stock) => {
                            const up = stock.change >= 0;
                            const rawCompanyName = stock.name.trim();
                            const normalizedCompanyName = rawCompanyName.replace(/\s*\(PSX\)\s*$/i, "").trim();
                            const displayCompanyName =
                              normalizedCompanyName.length > 0 &&
                              normalizedCompanyName.toUpperCase() !== stock.ticker.toUpperCase()
                                ? normalizedCompanyName
                                : null;
                            return (
                              <button
                                key={stock.ticker}
                                type="button"
                                onClick={() => openStock(stock.ticker)}
                                className={styles.trendingCard}
                              >
                                <div className={styles.trendingRow}>
                                  <span className={styles.trendingTickerGroup}>
                                    <StockLogo ticker={stock.ticker} size={16} />
                                    <span className={styles.trendingTickerDivider} aria-hidden="true" />
                                    <span className={styles.trendingTicker}>{stock.ticker}</span>
                                  </span>
                                  <span
                                    className={styles.trendingChange}
                                    style={{ color: up ? COLORS.gain : COLORS.loss }}
                                  >
                                    {up ? "+" : ""}
                                    {stock.changePercent.toFixed(2)}%
                                  </span>
                                </div>
                                {displayCompanyName ? <div className={styles.trendingName}>{displayCompanyName}</div> : null}
                                <div className={styles.trendingPrice}>
                                  <span className={styles.trendingPriceValue}>{formatPKRWithSymbol(stock.price)}</span>
                                  <span className={styles.trendingVolume}>Vol {formatCompactPKR(stock.volume)}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.foreignPlaceholder}>
                      {foreignActivity ? (
                        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ marginTop: 2, display: "flex", flexDirection: "column", gap: 14, width: "100%", textAlign: "left" }}>
                            <section style={{ borderTop: "none", paddingTop: 0 }}>
                              <div
                                style={{
                                  marginBottom: 4,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.08em",
                                  textTransform: "uppercase",
                                  color: "#b25a18",
                                }}
                              >
                                Foreign Activity
                              </div>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                  gap: "8px 18px",
                                }}
                              >
                                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                                  <span style={{ fontSize: 11, fontWeight: 620, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a8a8a" }}>
                                    Foreign Buy
                                  </span>
                                  <span style={{ fontSize: 16, lineHeight: 1.25, fontWeight: 720, color: COLORS.text }}>
                                    {formatCompactPkr(foreignActivity.foreignBuy)}
                                  </span>
                                </div>
                                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                                  <span style={{ fontSize: 11, fontWeight: 620, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a8a8a" }}>
                                    Foreign Sell
                                  </span>
                                  <span style={{ fontSize: 16, lineHeight: 1.25, fontWeight: 720, color: COLORS.text }}>
                                    {formatCompactPkr(foreignActivity.foreignSell)}
                                  </span>
                                </div>
                                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                                  <span style={{ fontSize: 11, fontWeight: 620, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a8a8a" }}>
                                    Foreign Net
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 16,
                                      lineHeight: 1.25,
                                      fontWeight: 720,
                                      color: netValueColor(foreignActivity.foreignNet),
                                    }}
                                  >
                                    {formatCompactPkr(foreignActivity.foreignNet)}
                                  </span>
                                </div>
                                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                                  <span style={{ fontSize: 11, fontWeight: 620, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a8a8a" }}>
                                    Latest Session
                                  </span>
                                  <span style={{ fontSize: 16, lineHeight: 1.25, fontWeight: 720, color: COLORS.text }}>
                                    {foreignActivity.sessionDate}
                                  </span>
                                </div>
                              </div>
                            </section>

                            <section style={{ paddingTop: 6, borderTop: "1px solid #f1ece6" }}>
                              <div
                                style={{
                                  marginBottom: 4,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.08em",
                                  textTransform: "uppercase",
                                  color: "#b25a18",
                                }}
                              >
                                Sector Flow
                              </div>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                  gap: "8px 18px",
                                }}
                              >
                                {foreignActivity.sectors.map((row) => (
                                  <div key={row.sector} style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                                    <span style={{ fontSize: 11, fontWeight: 620, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a8a8a" }}>
                                      {row.sector}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 16,
                                        lineHeight: 1.25,
                                        fontWeight: 720,
                                        color: netValueColor(row.net),
                                      }}
                                    >
                                      {formatCompactPkr(row.net)}
                                    </span>
                                    <span style={{ fontSize: 11.5, color: COLORS.muted, lineHeight: 1.3 }}>
                                      {formatDirection(row.direction)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </section>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className={styles.foreignTitle}>
                            Foreign investor activity will appear here
                          </p>
                          <p className={styles.foreignSubtext}>
                            Latest session data, updated after market close
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
