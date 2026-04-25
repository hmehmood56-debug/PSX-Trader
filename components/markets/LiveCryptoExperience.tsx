"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { LiveMarketAsset } from "@/lib/liveMarkets";

const palette = {
  orange: "#FF7A1A",
  bg: "#F5F7FF",
  border: "#DDE3F2",
  text: "#0E1425",
  muted: "#54607A",
  card: "#FFFFFF",
  green: "#00A06E",
  red: "#D14343",
} as const;

type LiveMarketsResponse = {
  data: LiveMarketAsset[];
  featuredIds?: string[];
  updatedAt: string;
  error?: string;
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : value >= 1 ? 3 : 6,
  }).format(value);
}

function formatUsdNullable(value: number | null) {
  if (value === null || Number.isNaN(value)) return "N/A";
  return formatUsd(value);
}

function formatVolume(value: number | null) {
  if (!value) return "N/A";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatChange(value: number | null) {
  if (value === null || Number.isNaN(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function LiveCryptoExperience() {
  const [crypto, setCrypto] = useState<LiveMarketAsset[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);

  const loadCrypto = useCallback(async () => {
    try {
      const response = await fetch("/api/live-markets", { cache: "no-store" });
      const payload = (await response.json()) as LiveMarketsResponse;

      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Unable to load live crypto market data.");
      }

      setCrypto(payload.data);
      setFeaturedIds(payload.featuredIds ?? []);
      setUpdatedAt(payload.updatedAt);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load live crypto market data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCrypto();
    const id = window.setInterval(() => {
      void loadCrypto();
    }, 5_000);
    return () => window.clearInterval(id);
  }, [loadCrypto]);

  const q = query.trim().toLowerCase();
  const filtered = crypto.filter((coin) => {
    if (!q) return true;
    return coin.name.toLowerCase().includes(q) || coin.symbol.toLowerCase().includes(q);
  });
  const featuredSet = new Set(featuredIds);
  const featuredCoins = crypto.filter((coin) => featuredSet.has(coin.id));
  const gridCoins = q ? filtered : featuredCoins.length > 0 ? featuredCoins : filtered;

  const topMovers = [...(featuredCoins.length > 0 ? featuredCoins : crypto)]
    .filter((coin) => coin.change24h !== null)
    .sort((a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0))
    .slice(0, 5);
  const moversTape = [...topMovers, ...topMovers];

  return (
    <div style={{ background: palette.bg }}>
      <div
        className="perch-shell"
        style={{ paddingTop: "clamp(24px, 5vw, 36px)", paddingBottom: "clamp(48px, 10vw, 72px)" }}
      >
        <section
          style={{
            border: `1px solid ${palette.border}`,
            borderRadius: 24,
            background:
              "radial-gradient(circle at top right, rgba(255,122,26,0.14), rgba(255,255,255,0.96) 35%), linear-gradient(145deg, #FFFFFF 10%, #F7FAFF 90%)",
            boxShadow: "0 18px 40px rgba(19, 29, 59, 0.08)",
            padding: "clamp(20px, 4vw, 34px) clamp(18px, 4vw, 30px)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: palette.orange,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Real-Time Markets
          </p>
          <h1
            style={{
              margin: "10px 0 0",
              color: palette.text,
              fontSize: "clamp(28px, 6vw, 44px)",
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
            }}
          >
            Crypto markets at a glance
          </h1>
          <p style={{ marginTop: 14, color: palette.muted, fontSize: 15, lineHeight: 1.65, maxWidth: 760 }}>
            Live digital asset prices, major movers, and market activity in one premium trading surface.
            Updated in real time every few seconds.
          </p>
          <p style={{ marginTop: 10, marginBottom: 0, color: "#4A5670", fontSize: 13, fontWeight: 550 }}>
            {updatedAt
              ? `Last updated ${new Date(updatedAt).toLocaleTimeString("en-US")}`
              : "Awaiting first live update..."}
          </p>
          <div style={{ marginTop: 14 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search crypto by name or symbol"
              aria-label="Search crypto by name or symbol"
              style={{
                width: "100%",
                maxWidth: 520,
                minHeight: 48,
                borderRadius: 14,
                border: `1px solid #CBD6EE`,
                padding: "0 16px",
                fontSize: 16,
                outline: "none",
                background: "rgba(255,255,255,0.88)",
              }}
            />
          </div>
        </section>

        {topMovers.length > 0 && (
          <section
            className="perch-crypto-movers"
            style={{
              marginTop: 14,
              border: `1px solid ${palette.border}`,
              borderRadius: 14,
              overflow: "hidden",
              background: "#FFFFFF",
              boxShadow: "0 8px 22px rgba(17, 28, 54, 0.06)",
            }}
          >
            <p style={{ margin: 0, padding: "10px 14px", color: palette.muted, fontSize: 12, fontWeight: 600 }}>
              Major market movers
            </p>
            <div
              className="perch-ticker-row"
              style={{
                borderTop: `1px solid ${palette.border}`,
                whiteSpace: "nowrap",
              }}
            >
              <div className="perch-ticker-track">
                {moversTape.map((coin, idx) => (
                  <Link
                    key={`${coin.id}-${idx}`}
                    href={`/markets/crypto/${coin.id}`}
                    style={{
                      minHeight: 48,
                      padding: "0 14px",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      borderRight: `1px solid ${palette.border}`,
                      color: palette.text,
                      fontSize: 13,
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <span style={{ color: palette.orange, fontWeight: 700 }}>{coin.symbol}</span>
                    <span style={{ color: palette.text, fontVariantNumeric: "tabular-nums" }}>
                      {formatUsd(coin.price)}
                    </span>
                    <span
                      style={{
                        color: coin.change24h !== null && coin.change24h >= 0 ? palette.green : palette.red,
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatChange(coin.change24h)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="perch-crypto-grid" style={{ marginTop: 18 }}>
          {loading
            ? ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA"].map((symbol) => (
                <article
                  key={symbol}
                  style={{
                    border: `1px solid #DAE2F3`,
                    borderRadius: 16,
                    background: "linear-gradient(180deg, #FFFFFF 0%, #F7FAFF 100%)",
                    padding: 20,
                    boxShadow: "0 10px 24px rgba(21, 33, 62, 0.07)",
                  }}
                >
                  <h2 style={{ margin: 0, color: palette.text, fontSize: 22, fontWeight: 700 }}>{symbol}</h2>
                  <p style={{ marginTop: 10, color: palette.muted, fontSize: 14 }}>Loading live price...</p>
                </article>
              ))
            : gridCoins.map((coin) => {
                const up = (coin.change24h ?? 0) >= 0;
                return (
                  <Link
                    key={coin.id}
                    href={`/markets/crypto/${coin.id}`}
                    style={{
                      textDecoration: "none",
                      border: `1px solid #D8E0F0`,
                      borderRadius: 16,
                      background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFF 100%)",
                      padding: "clamp(16px, 4vw, 20px)",
                      color: palette.text,
                      boxShadow: "0 12px 28px rgba(17, 28, 54, 0.08)",
                      display: "block",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <p style={{ margin: 0, fontSize: 12, color: "#445171", fontWeight: 700 }}>{coin.symbol}</p>
                      <p style={{ margin: 0, fontSize: 12, color: palette.muted }}>
                        {coin.rank ? `#${coin.rank}` : "Rank N/A"}
                      </p>
                    </div>
                    <h2
                      style={{
                        margin: "8px 0 0",
                        color: palette.text,
                        fontSize: "clamp(18px, 4vw, 22px)",
                        fontWeight: 700,
                        lineHeight: 1.25,
                      }}
                    >
                      {coin.name}
                    </h2>
                    <p
                      style={{
                        margin: "12px 0 0",
                        color: palette.text,
                        fontSize: "clamp(22px, 5vw, 30px)",
                        fontWeight: 700,
                      }}
                    >
                      {formatUsd(coin.price)}
                    </p>
                    <p
                      style={{
                        marginTop: 8,
                        color: coin.change24h === null ? palette.muted : up ? palette.green : palette.red,
                        fontSize: 14,
                        fontWeight: 650,
                      }}
                    >
                      24h: {formatChange(coin.change24h)}
                    </p>
                    <p style={{ marginTop: 8, color: palette.muted, fontSize: 13 }}>
                      24h High: {formatUsdNullable(coin.high24h)}
                    </p>
                    <p style={{ marginTop: 6, color: palette.muted, fontSize: 13 }}>
                      24h Low: {formatUsdNullable(coin.low24h)}
                    </p>
                    <p style={{ marginTop: 6, color: palette.muted, fontSize: 13 }}>
                      Volume (24h): {formatVolume(coin.volume24h)}
                    </p>
                    <p style={{ marginTop: 6, color: palette.muted, fontSize: 13 }}>
                      Quote Volume (24h): {formatVolume(coin.quoteVolume24h)}
                    </p>
                  </Link>
                );
              })}
        </section>

        {!loading && gridCoins.length === 0 && (
          <section
            style={{
              marginTop: 14,
              border: `1px solid ${palette.border}`,
              borderRadius: 12,
              background: palette.card,
              padding: "14px 16px",
              color: palette.muted,
              fontSize: 14,
            }}
          >
            No assets match your search query.
          </section>
        )}

        {error && (
          <section
            style={{
              marginTop: 14,
              border: `1px solid ${palette.border}`,
              borderRadius: 12,
              background: "#FFF5F2",
              padding: "12px 14px",
              color: "#A3452F",
              fontSize: 13,
            }}
          >
            Live crypto data is temporarily unavailable. We will keep trying every 5 seconds.
          </section>
        )}
      </div>
    </div>
  );
}
