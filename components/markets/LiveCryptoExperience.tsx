"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { LiveMarketAsset } from "@/lib/liveMarkets";

const palette = {
  orange: "#C45000",
  bg: "#FFFFFF",
  border: "#E8E8E8",
  text: "#1A1A1A",
  muted: "#6B6B6B",
} as const;

type LiveMarketsResponse = {
  data: LiveMarketAsset[];
  updatedAt: string;
  error?: string;
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatMarketCap(value: number | null) {
  if (!value) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatVolume(value: number | null) {
  if (!value) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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

  const loadCrypto = useCallback(async () => {
    try {
      const response = await fetch("/api/live-markets", { cache: "no-store" });
      const payload = (await response.json()) as LiveMarketsResponse;

      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Unable to load live crypto market data.");
      }

      setCrypto(payload.data);
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
    }, 30_000);
    return () => window.clearInterval(id);
  }, [loadCrypto]);

  const q = query.trim().toLowerCase();
  const filtered = crypto.filter((coin) => {
    if (!q) return true;
    return coin.name.toLowerCase().includes(q) || coin.symbol.toLowerCase().includes(q);
  });

  const topMovers = [...crypto]
    .filter((coin) => coin.change24h !== null)
    .sort((a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0))
    .slice(0, 5);

  return (
    <div style={{ background: palette.bg }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "36px 32px 72px" }}>
        <section
          style={{
            border: `1px solid ${palette.border}`,
            borderRadius: 20,
            background: "#FFFFFF",
            padding: "28px 26px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: palette.orange,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Live Crypto
          </p>
          <h1 style={{ margin: "10px 0 0", color: palette.text, fontSize: 40, lineHeight: 1.12 }}>
            Live crypto markets
          </h1>
          <p style={{ marginTop: 12, color: palette.muted, fontSize: 16, lineHeight: "28px", maxWidth: 760 }}>
            Browse major digital assets with live pricing, 24h movement, market cap, and volume.
            Data refreshes automatically every 30 seconds through the Perch live feed.
          </p>
          <p style={{ marginTop: 8, marginBottom: 0, color: palette.muted, fontSize: 13 }}>
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
                maxWidth: 460,
                height: 48,
                borderRadius: 12,
                border: `1px solid ${palette.border}`,
                padding: "0 14px",
                fontSize: 15,
                outline: "none",
              }}
            />
          </div>
        </section>

        {topMovers.length > 0 && (
          <section
            style={{
              marginTop: 14,
              border: `1px solid ${palette.border}`,
              borderRadius: 14,
              padding: "12px 14px",
              background: "#FFFFFF",
              display: "flex",
              gap: 12,
              overflowX: "auto",
            }}
          >
            {topMovers.map((coin) => (
              <Link
                key={coin.id}
                href={`/markets/crypto/${coin.id}`}
                style={{
                  textDecoration: "none",
                  border: `1px solid ${palette.border}`,
                  borderRadius: 999,
                  padding: "8px 10px",
                  display: "inline-flex",
                  gap: 8,
                  color: palette.text,
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                <strong>{coin.symbol}</strong>
                <span style={{ color: coin.change24h !== null && coin.change24h >= 0 ? "#007A4C" : "#C0392B" }}>
                  {formatChange(coin.change24h)}
                </span>
              </Link>
            ))}
          </section>
        )}

        <section
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          {loading
            ? ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA"].map((symbol) => (
                <article
                  key={symbol}
                  style={{
                    border: `1px solid ${palette.border}`,
                    borderRadius: 14,
                    background: "#FFFFFF",
                    padding: 20,
                  }}
                >
                  <h2 style={{ margin: 0, color: palette.text, fontSize: 22, fontWeight: 700 }}>{symbol}</h2>
                  <p style={{ marginTop: 10, color: palette.muted, fontSize: 14 }}>Loading live price...</p>
                </article>
              ))
            : filtered.map((coin) => {
                const up = (coin.change24h ?? 0) >= 0;
                return (
                  <Link
                    key={coin.id}
                    href={`/markets/crypto/${coin.id}`}
                    style={{
                      textDecoration: "none",
                      border: `1px solid ${palette.border}`,
                      borderRadius: 14,
                      background: "#FFFFFF",
                      padding: 20,
                      color: palette.text,
                      boxShadow: "0 8px 22px rgba(23,23,23,0.05)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <p style={{ margin: 0, fontSize: 12, color: palette.muted, fontWeight: 700 }}>{coin.symbol}</p>
                      <p style={{ margin: 0, fontSize: 12, color: palette.muted }}>
                        {coin.rank ? `#${coin.rank}` : "Rank N/A"}
                      </p>
                    </div>
                    <h2 style={{ margin: "8px 0 0", color: palette.text, fontSize: 22, fontWeight: 700 }}>{coin.name}</h2>
                    <p style={{ margin: "12px 0 0", color: palette.text, fontSize: 30, fontWeight: 700 }}>
                      {formatUsd(coin.price)}
                    </p>
                    <p
                      style={{
                        marginTop: 8,
                        color: coin.change24h === null ? palette.muted : up ? "#007A4C" : "#C0392B",
                        fontSize: 14,
                        fontWeight: 650,
                      }}
                    >
                      24h: {formatChange(coin.change24h)}
                    </p>
                    <p style={{ marginTop: 8, color: palette.muted, fontSize: 13 }}>
                      Market cap: {formatMarketCap(coin.marketCap)}
                    </p>
                    <p style={{ marginTop: 6, color: palette.muted, fontSize: 13 }}>
                      Volume (24h): {formatVolume(coin.volume24h)}
                    </p>
                  </Link>
                );
              })}
        </section>

        {!loading && filtered.length === 0 && (
          <section
            style={{
              marginTop: 14,
              border: `1px solid ${palette.border}`,
              borderRadius: 12,
              background: "#FFFFFF",
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
              background: "#FFF8F6",
              padding: "12px 14px",
              color: "#A3452F",
              fontSize: 13,
            }}
          >
            Live crypto data is temporarily unavailable. We will keep trying every 30 seconds.
          </section>
        )}
      </div>
    </div>
  );
}
