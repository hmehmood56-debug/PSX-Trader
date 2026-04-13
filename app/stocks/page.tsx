"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { getAllSectors } from "@/lib/mockData";
import { useLivePrices } from "@/lib/priceSimulator";
import { formatCompactPKR, formatPKRWithSymbol } from "@/lib/format";

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

type LiveStock = {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
};

function SearchHero({
  q,
  setQ,
  sector,
  setSector,
  sectors,
}: {
  q: string;
  setQ: (value: string) => void;
  sector: string;
  setSector: (value: string) => void;
  sectors: string[];
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
      <div style={{ fontSize: 13, color: COLORS.muted, fontWeight: 600 }}>
        Discover PSX opportunities
      </div>
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 220px", gap: 12 }}>
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
  items: LiveStock[];
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
        Live market strip
      </div>
      <div
        style={{
          borderTop: `1px solid ${COLORS.border}`,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <div className="tickerTrack">
          {tape.map((s, idx) => {
            const up = s.change >= 0;
            return (
              <button
                key={`${s.ticker}-${idx}`}
                type="button"
                onClick={() => onOpen(s.ticker)}
                style={{
                  height: 48,
                  padding: "0 14px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  borderRight: `1px solid ${COLORS.border}`,
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
  stocks: LiveStock[];
  onOpen: (ticker: string) => void;
}) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0, fontSize: 20, color: COLORS.text }}>{title}</h2>
        <span style={{ fontSize: 12, color: COLORS.muted }}>{subtitle}</span>
      </div>
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
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
  stock: LiveStock;
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
        padding: 14,
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
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

export default function StocksPage() {
  const router = useRouter();
  const { getStocksWithLive } = useLivePrices();
  const stocks = getStocksWithLive() as LiveStock[];
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
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 32 }}>
        <SearchHero
          q={q}
          setQ={setQ}
          sector={sector}
          setSector={setSector}
          sectors={sectors}
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
            No stocks match your search.
          </div>
        ) : (
          <>
            <StockSection
              title={hasSearch ? "Search results" : "Trending now"}
              subtitle={hasSearch ? `${filtered.length} matches` : "Largest movers today"}
              stocks={hasSearch ? filtered.slice(0, 8) : trending}
              onOpen={(ticker) => router.push(`/stock/${ticker}`)}
            />
            <StockSection
              title="Most active"
              subtitle="Highest traded volume"
              stocks={mostActive}
              onOpen={(ticker) => router.push(`/stock/${ticker}`)}
            />
          </>
        )}
      </div>
      <style jsx>{`
        .tickerTrack {
          display: inline-flex;
          min-width: 100%;
          animation: tickerScroll 36s linear infinite;
        }
        .tickerTrack:hover {
          animation-play-state: paused;
        }
        @keyframes tickerScroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
