"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { getAllSectors } from "@/lib/mockData";
import { useLivePrices, type ReplayStock } from "@/lib/priceSimulator";
import { formatCompactPKR, formatPKRWithSymbol } from "@/lib/format";

const COLORS = {
  orange: "#C45000",
  bg: "#FFFFFF",
  border: "#E8E8E8",
  text: "#1A1A1A",
  muted: "#6B6B6B",
  gain: "#007A4C",
  loss: "#C0392B",
} as const;

function SearchHero({
  q,
  setQ,
  sector,
  setSector,
  sectors,
  replayDate,
  isPlaceholderData,
}: {
  q: string;
  setQ: (value: string) => void;
  sector: string;
  setSector: (value: string) => void;
  sectors: string[];
  replayDate: string;
  isPlaceholderData: boolean;
}) {
  return (
    <section
      style={{
        background: "linear-gradient(140deg, #FFF8F2 0%, #FFFFFF 100%)",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        padding: 20,
        boxShadow: "0 8px 24px rgba(196,80,0,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Replay date {replayDate || "N/A"}
        </div>
        <span
          style={{
            fontSize: 10,
            color: "#355b48",
            fontWeight: 700,
            border: `1px solid #d8e3db`,
            borderRadius: 6,
            padding: "5px 8px",
            background: "#f4faf6",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {isPlaceholderData ? "Sample Market Session" : "Exchange Context: Simulated"}
        </span>
      </div>
      <h1
        style={{
          margin: "8px 0 0",
          fontSize: "clamp(22px, 5vw, 30px)",
          color: COLORS.text,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
        }}
      >
        Pakistan Stock Exchange (Simulated)
      </h1>
      <p style={{ marginTop: 10, marginBottom: 0, color: COLORS.muted, fontSize: 14, lineHeight: "22px", maxWidth: 780 }}>
        Practice trading Pakistan equities with virtual funds in a realistic paper-trading environment.
      </p>
      <div className="perch-psx-search-grid" style={{ marginTop: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ticker or company"
          aria-label="Search ticker or company"
          style={{
            width: "100%",
            height: 56,
            borderRadius: 14,
            border: `1px solid ${COLORS.border}`,
            padding: "0 18px",
            fontSize: 16,
            outline: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = COLORS.orange;
            e.currentTarget.style.boxShadow = "0 0 0 4px rgba(196,80,0,0.18)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = COLORS.border;
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
          }}
        />

        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          aria-label="Filter by sector"
          style={{
            width: "100%",
            height: 56,
            borderRadius: 14,
            border: `1px solid ${COLORS.border}`,
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
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        overflow: "hidden",
        background: "#FFFFFF",
      }}
    >
      <div style={{ padding: "10px 14px", fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>
        Simulated PSX pulse
      </div>
      <div
        className="perch-ticker-row"
        style={{
          borderTop: `1px solid ${COLORS.border}`,
          whiteSpace: "nowrap",
        }}
      >
        <div className="perch-ticker-track">
          {tape.map((s, idx) => {
            const up = s.change >= 0;
            return (
              <button
                key={`${s.ticker}-${idx}`}
                type="button"
                onClick={() => onOpen(s.ticker)}
                style={{
                  minHeight: 48,
                  padding: "0 14px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  borderRight: `1px solid ${COLORS.border}`,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span style={{ color: COLORS.orange, fontWeight: 700 }}>{s.ticker}</span>
                <span style={{ color: COLORS.text, fontVariantNumeric: "tabular-nums" }}>
                  {formatPKRWithSymbol(s.price)}
                </span>
                <span
                  style={{
                    color: up ? COLORS.gain : COLORS.loss,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {up ? "+" : ""}
                  {s.changePercent.toFixed(2)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StockSection({
  title,
  subtitle,
  stocks,
  onOpen,
}: {
  title: string;
  subtitle: string;
  stocks: ReplayStock[];
  onOpen: (ticker: string) => void;
}) {
  return (
    <section style={{ marginTop: 22 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "clamp(17px, 3.8vw, 20px)", color: COLORS.text }}>{title}</h2>
        <span style={{ fontSize: 12, color: COLORS.muted }}>{subtitle}</span>
      </div>
      <div className="perch-stock-card-grid" style={{ marginTop: 12 }}>
        {stocks.map((stock) => (
          <StockCard key={stock.ticker} stock={stock} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function StockCard({
  stock,
  onOpen,
}: {
  stock: ReplayStock;
  onOpen: (ticker: string) => void;
}) {
  const up = stock.change >= 0;
  return (
    <button
      type="button"
      onClick={() => onOpen(stock.ticker)}
      style={{
        textAlign: "left",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        background: "#FFFFFF",
        cursor: "pointer",
        padding: "clamp(14px, 3vw, 16px)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: COLORS.orange, fontWeight: 800, fontSize: 16 }}>{stock.ticker}</div>
        <div style={{ fontSize: 12, color: COLORS.muted }}>{stock.sector}</div>
      </div>
      <div
        style={{
          marginTop: 6,
          color: COLORS.muted,
          fontSize: 13,
          minHeight: 34,
          lineHeight: "17px",
          overflow: "hidden",
        }}
      >
        {stock.name}
      </div>
      <div style={{ marginTop: 10, color: COLORS.text, fontWeight: 700, fontSize: 18 }}>
        {formatPKRWithSymbol(stock.price)}
      </div>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          alignItems: "center",
        }}
      >
        <span
          style={{
            color: up ? COLORS.gain : COLORS.loss,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {up ? "+" : ""}
          {stock.change.toFixed(2)} ({up ? "+" : ""}
          {stock.changePercent.toFixed(2)}%)
        </span>
        <span style={{ color: COLORS.muted, fontVariantNumeric: "tabular-nums" }}>
          Vol {formatCompactPKR(stock.volume)}
        </span>
      </div>
    </button>
  );
}

export function SimulatedPsxExperience() {
  const router = useRouter();
  const { getStocksWithLive, currentDate, isPlaceholderData } = useLivePrices();
  const stocks = getStocksWithLive();
  const sectors = useMemo(() => ["All", ...getAllSectors()], []);

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

  const trending = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
        .slice(0, 6),
    [filtered]
  );

  const mostActive = useMemo(
    () => [...filtered].sort((a, b) => b.volume - a.volume).slice(0, 6),
    [filtered]
  );

  const marketTape = useMemo(() => [...stocks].sort((a, b) => b.marketCap - a.marketCap), [stocks]);
  const hasSearch = q.trim().length > 0 || sector !== "All";

  return (
    <div style={{ background: COLORS.bg }}>
      <div className="perch-shell perch-shell-wide perch-psx-shell">
        <SearchHero
          q={q}
          setQ={setQ}
          sector={sector}
          setSector={setSector}
          sectors={sectors}
          replayDate={currentDate}
          isPlaceholderData={isPlaceholderData}
        />

        <MarketTickerTape items={marketTape} onOpen={(ticker) => router.push(`/stock/${ticker}`)} />

        {filtered.length === 0 ? (
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
            No simulated PSX listings match your current filters.
          </div>
        ) : (
          <>
            <StockSection
              title={hasSearch ? "Search results" : "Trending in simulation"}
              subtitle={hasSearch ? `${filtered.length} listings found` : "Largest simulated PSX movers"}
              stocks={hasSearch ? filtered.slice(0, 8) : trending}
              onOpen={(ticker) => router.push(`/stock/${ticker}`)}
            />
            <StockSection
              title="Most active"
              subtitle="Highest traded volume in the simulated session"
              stocks={mostActive}
              onOpen={(ticker) => router.push(`/stock/${ticker}`)}
            />
          </>
        )}
      </div>
    </div>
  );
}
