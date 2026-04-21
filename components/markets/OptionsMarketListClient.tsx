"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatPKRWithSymbol } from "@/lib/format";
import { getPsxQuoteUrl, getPsxSymbolsUrl } from "@/lib/marketSnapshotUrl";
import { startRouteProgress } from "@/lib/routeProgress";

const COLORS = {
  orange: "#C45000",
  orangeSoft: "rgba(196, 80, 0, 0.12)",
  bg: "#FFFFFF",
  border: "#E8E8E8",
  text: "#1A1A1A",
  muted: "#6B6B6B",
} as const;

type SymbolsResponse = { data?: string[] };

type QuotePayload = {
  data?: {
    price?: number;
    changePercent?: number;
  } | null;
};

const MAX_CARDS = 64;

export function OptionsMarketListClient() {
  const [q, setQ] = useState("");
  const [tickers, setTickers] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<
    Record<string, { price: number; changePercent?: number }>
  >({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getPsxSymbolsUrl(), { cache: "no-store" });
        const payload = (await res.json()) as SymbolsResponse;
        const list = Array.isArray(payload.data) ? payload.data : [];
        if (!cancelled) {
          setTickers(list);
          setLoadError(null);
        }
      } catch {
        if (!cancelled) setLoadError("Could not load symbols. Try again shortly.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    const needle = q.trim().toUpperCase();
    const filtered = needle
      ? tickers.filter((t) => t.includes(needle))
      : tickers;
    return filtered.slice(0, 400);
  }, [q, tickers]);

  const displayRows = useMemo(() => rows.slice(0, MAX_CARDS), [rows]);
  const rowKey = displayRows.join(",");

  useEffect(() => {
    let cancelled = false;
    const list = displayRows;
    if (list.length === 0) return () => {};

    (async () => {
      const chunkSize = 8;
      for (let i = 0; i < list.length; i += chunkSize) {
        if (cancelled) return;
        const chunk = list.slice(i, i + chunkSize);
        const batch: Record<string, { price: number; changePercent?: number }> = {};
        await Promise.all(
          chunk.map(async (t) => {
            try {
              const res = await fetch(getPsxQuoteUrl(t), {
                cache: "no-store",
              });
              const json = (await res.json()) as QuotePayload;
              const d = json.data;
              if (d && typeof d.price === "number") {
                batch[t] = {
                  price: d.price,
                  changePercent:
                    typeof d.changePercent === "number" ? d.changePercent : undefined,
                };
              }
            } catch {
              /* keep card without price */
            }
          })
        );
        if (cancelled) return;
        setQuotes((prev) => ({ ...prev, ...batch }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rowKey, displayRows]);

  return (
    <div style={{ background: COLORS.bg }}>
      <style>{`
        .opt-list-card {
          display: block;
          text-decoration: none;
          color: inherit;
          border-radius: 12px;
          padding: 18px 20px;
          border: 1px solid ${COLORS.border};
          background: #fff;
          box-shadow: 0 4px 14px rgba(23, 23, 23, 0.06);
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }
        .opt-list-card:hover {
          transform: scale(1.02);
          box-shadow: 0 12px 28px rgba(23, 23, 23, 0.1);
          border-color: ${COLORS.orange};
        }
        .opt-list-card:focus-visible {
          outline: 2px solid ${COLORS.orange};
          outline-offset: 2px;
        }
      `}</style>
      <div className="perch-shell" style={{ paddingTop: 32, paddingBottom: 64 }}>
        <section
          style={{
            background: "linear-gradient(140deg, #FFF8F2 0%, #FFFFFF 100%)",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            padding: 24,
            marginBottom: 28,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: COLORS.muted,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Options Simulator
          </p>
          <h1
            style={{
              margin: "12px 0 0",
              fontSize: "clamp(24px, 5vw, 32px)",
              color: COLORS.text,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            Practice options on PSX names
          </h1>
          <p
            style={{
              marginTop: 12,
              marginBottom: 0,
              color: COLORS.muted,
              fontSize: 15,
              lineHeight: 1.65,
              maxWidth: 640,
            }}
          >
            Pick a stock to build a practice contract. Live prices update from the PSX feed.
          </p>
        </section>

        <label
          style={{
            display: "block",
            marginBottom: 10,
            fontSize: 13,
            color: COLORS.muted,
            fontWeight: 600,
          }}
        >
          Search tickers
        </label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by ticker…"
          aria-label="Search tickers"
          style={{
            width: "100%",
            maxWidth: 480,
            height: 52,
            borderRadius: 14,
            border: `1px solid ${COLORS.border}`,
            padding: "0 18px",
            fontSize: 16,
            outline: "none",
            marginBottom: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        />
        {rows.length > MAX_CARDS && (
          <p style={{ margin: "0 0 20px", fontSize: 13, color: COLORS.muted }}>
            Showing first {MAX_CARDS} matches — narrow your search to find a ticker faster.
          </p>
        )}

        {loadError && (
          <p style={{ color: "#a32020", fontSize: 14, marginBottom: 16 }} role="alert">
            {loadError}
          </p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
            gap: 18,
          }}
        >
          {displayRows.map((t) => {
            const qd = quotes[t];
            const pct =
              qd?.changePercent !== undefined ? qd.changePercent : null;
            const pos = pct !== null && pct > 0;
            const neg = pct !== null && pct < 0;
            return (
              <Link
                key={t}
                href={`/markets/options/${encodeURIComponent(t)}`}
                className="opt-list-card"
                onClick={() => startRouteProgress()}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        letterSpacing: "0.02em",
                        color: COLORS.text,
                        lineHeight: 1.2,
                      }}
                    >
                      {t}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 17, fontWeight: 650, color: COLORS.text }}>
                      {qd ? formatPKRWithSymbol(qd.price) : "—"}
                    </div>
                    {pct !== null && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 14,
                          fontWeight: 650,
                          color: pos ? "#0d7a4f" : neg ? "#b83232" : COLORS.muted,
                        }}
                      >
                        {pos ? "+" : ""}
                        {pct.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 14,
                    fontWeight: 700,
                    color: COLORS.orange,
                  }}
                >
                  Trade Options
                  <span aria-hidden style={{ fontSize: 16 }}>
                    →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
