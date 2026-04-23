"use client";

import { useRouter } from "next/navigation";
import { startRouteProgress } from "@/lib/routeProgress";
import { useMemo, useState } from "react";
import { useLivePrices, type ReplayStock } from "@/lib/priceSimulator";
import { formatCompactPKR, formatPKRWithSymbol } from "@/lib/format";
import { BarChart3, Circle, Gauge, TrendingDown, TrendingUp } from "lucide-react";

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

function MarketSnapshotStrip({
  breadth,
  turnover,
  sectorLeadership,
}: {
  breadth: number;
  turnover: number;
  sectorLeadership: string;
}) {
  const advancers = Math.round(Math.max(0, Math.min(1, breadth)) * 100);
  return (
    <section
      style={{
        marginTop: 14,
        border: `1px solid #ececec`,
        borderRadius: 12,
        background: "#FFFFFF",
        padding: "14px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
        }}
      >
        <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: "#8a8a8a", textTransform: "uppercase", letterSpacing: "0.06em" }}>Market Breadth</div>
          <div style={{ marginTop: 3, fontSize: 20, fontWeight: 700, color: COLORS.text }}>{advancers}% Advancers</div>
        </div>
        <div style={{ background: "#fafaf9", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: "#8a8a8a", textTransform: "uppercase", letterSpacing: "0.06em" }}>Turnover</div>
          <div style={{ marginTop: 3, fontSize: 18, fontWeight: 700, color: COLORS.text }}>{formatCompactPKR(turnover)}</div>
        </div>
        <div style={{ background: "#fff7ed", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: "#8a8a8a", textTransform: "uppercase", letterSpacing: "0.06em" }}>Sector Leadership</div>
          <div style={{ marginTop: 3, fontSize: 15, fontWeight: 700, color: COLORS.text }}>{sectorLeadership}</div>
        </div>
      </div>
    </section>
  );
}

function CompactSnapshotRow({
  mostActive,
  topGainer,
  topLoser,
  sentiment,
}: {
  mostActive: ReplayStock | null;
  topGainer: ReplayStock | null;
  topLoser: ReplayStock | null;
  sentiment: "Bullish" | "Neutral" | "Bearish";
}) {
  return (
    <section
      style={{
        marginTop: 12,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: 10,
      }}
    >
      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, background: "#FFFFFF", padding: "11px 12px" }}>
        <span style={{ width: 24, height: 24, borderRadius: 8, background: "#fff7ed", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <BarChart3 className="w-4 h-4" color="#9A3412" />
        </span>
        <div style={{ marginTop: 6, fontSize: 10, color: COLORS.mutedSoft, textTransform: "uppercase", letterSpacing: "0.06em" }}>Most Active</div>
        <div style={{ marginTop: 2, fontWeight: 700, color: COLORS.text, fontSize: 14 }}>{mostActive?.ticker ?? "N/A"}</div>
        <div style={{ marginTop: 1, color: COLORS.muted, fontSize: 12 }}>
          {mostActive ? `Vol ${formatCompactPKR(mostActive.volume)}` : "No live volume"}
        </div>
      </div>

      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, background: "#FFFFFF", padding: "11px 12px" }}>
        <span style={{ width: 24, height: 24, borderRadius: 8, background: "#ecfdf3", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <TrendingUp className="w-4 h-4" color={COLORS.gain} />
        </span>
        <div style={{ marginTop: 6, fontSize: 10, color: COLORS.mutedSoft, textTransform: "uppercase", letterSpacing: "0.06em" }}>Top Gainer</div>
        <div style={{ marginTop: 2, fontWeight: 700, color: COLORS.text, fontSize: 14 }}>{topGainer?.ticker ?? "N/A"}</div>
        <div style={{ marginTop: 1, color: COLORS.gain, fontSize: 12, fontWeight: 700 }}>
          {topGainer ? `+${topGainer.changePercent.toFixed(2)}%` : "No gainers"}
        </div>
      </div>

      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, background: "#FFFFFF", padding: "11px 12px" }}>
        <span style={{ width: 24, height: 24, borderRadius: 8, background: "#fff1f2", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <TrendingDown className="w-4 h-4" color={COLORS.loss} />
        </span>
        <div style={{ marginTop: 6, fontSize: 10, color: COLORS.mutedSoft, textTransform: "uppercase", letterSpacing: "0.06em" }}>Top Loser</div>
        <div style={{ marginTop: 2, fontWeight: 700, color: COLORS.text, fontSize: 14 }}>{topLoser?.ticker ?? "N/A"}</div>
        <div style={{ marginTop: 1, color: COLORS.loss, fontSize: 12, fontWeight: 700 }}>
          {topLoser ? `${topLoser.changePercent.toFixed(2)}%` : "No losers"}
        </div>
      </div>

      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, background: "#FFFFFF", padding: "11px 12px" }}>
        <span style={{ width: 24, height: 24, borderRadius: 8, background: "#fff7ed", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Gauge className="w-4 h-4" color="#9A3412" />
        </span>
        <div style={{ marginTop: 6, fontSize: 10, color: COLORS.mutedSoft, textTransform: "uppercase", letterSpacing: "0.06em" }}>Market Sentiment</div>
        <div style={{ marginTop: 2, fontWeight: 700, color: COLORS.text, fontSize: 14 }}>{sentiment}</div>
      </div>
    </section>
  );
}

function TrendingSection({
  stocks,
  onOpen,
}: {
  stocks: ReplayStock[];
  onOpen: (ticker: string) => void;
}) {
  return (
    <section style={{ marginTop: 18 }}>
      <h2 style={{ margin: 0, fontSize: "clamp(16px, 3.4vw, 18px)", color: COLORS.text, fontWeight: 600 }}>
        Trending now
      </h2>
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        {stocks.map((stock) => {
          const up = stock.change >= 0;
          return (
            <button
              key={stock.ticker}
              type="button"
              onClick={() => onOpen(stock.ticker)}
              style={{
                textAlign: "left",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                background: "#FFFFFF",
                cursor: "pointer",
                padding: 14,
                WebkitTapHighlightColor: "transparent",
                display: "grid",
                gridTemplateColumns: "3px 1fr",
                gap: 10,
              }}
            >
              <span style={{ background: COLORS.orange, borderRadius: 3 }} />
              <span>
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ color: COLORS.text, fontWeight: 700, fontSize: 15 }}>{stock.ticker}</span>
                </span>
                <span style={{ marginTop: 6, color: COLORS.muted, fontSize: 12, lineHeight: "16px", minHeight: 32, display: "block" }}>
                  {stock.name}
                </span>
                <span style={{ marginTop: 8, color: COLORS.text, fontWeight: 700, fontSize: 19, display: "block" }}>
                  {formatPKRWithSymbol(stock.price)}
                </span>
                <span style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      color: up ? COLORS.gain : COLORS.loss,
                      fontWeight: 700,
                      fontSize: 14,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {up ? "+" : ""}
                    {stock.changePercent.toFixed(2)}%
                  </span>
                  <span style={{ color: COLORS.muted, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                    Vol {formatCompactPKR(stock.volume)}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

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
  const stocks = useMemo(() => allStocks.filter((stock) => stock.ticker.length > 0), [allStocks]);
  const market = getMarketSnapshot();
  const sectors = useMemo(
    () => ["All", ...Array.from(new Set(stocks.map((s) => s.sector))).sort((a, b) => a.localeCompare(b))],
    [stocks]
  );

  const [q, setQ] = useState("");
  const [sector, setSector] = useState("All");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return stocks.filter((s) => {
      const secOk = sector === "All" || s.sector === sector;
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
        <CompactSnapshotRow
          mostActive={mostActive}
          topGainer={topGainer}
          topLoser={topLoser}
          sentiment={marketSentiment}
        />
        <MarketSnapshotStrip
          breadth={market.marketBreadth}
          turnover={market.turnoverEstimate}
          sectorLeadership={sectorLeadership}
        />

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
            <TrendingSection
              stocks={trendingNow}
              onOpen={(ticker) => {
                startRouteProgress();
                router.push(`/stock/${ticker}`);
              }}
            />
            {filtered.length === 0 ? (
              <div
                style={{
                  marginTop: 14,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  background: "#FFFFFF",
                  padding: 12,
                  color: COLORS.muted,
                  fontSize: 13,
                }}
              >
                No matching ticker in current universe.
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
