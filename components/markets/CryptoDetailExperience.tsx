"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LiveMarketDetail } from "@/lib/liveMarkets";
import { logAnalyticsEvent } from "@/lib/analytics/client";

const palette = {
  orange: "#FF7A1A",
  bg: "#F5F7FF",
  border: "#DDE3F2",
  text: "#0E1425",
  muted: "#54607A",
  green: "#00A06E",
  red: "#D14343",
} as const;

const RANGE_OPTIONS = ["1D", "7D", "1M", "3M", "1Y", "ALL"] as const;
type ChartRange = (typeof RANGE_OPTIONS)[number];

type DetailResponse = {
  data?: LiveMarketDetail;
  range?: ChartRange;
  updatedAt?: string;
  error?: string;
};

function formatUsd(value: number | null) {
  if (value === null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : value >= 1 ? 3 : 6,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatCompact(value: number | null) {
  if (value === null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatAxisPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 3,
  }).format(value);
}

export function CryptoDetailExperience({ id }: { id: string }) {
  const [asset, setAsset] = useState<LiveMarketDetail | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<ChartRange>("1D");

  const loadDetail = useCallback(async () => {
    try {
      const response = await fetch(`/api/live-markets/${id}?range=${selectedRange}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as DetailResponse;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Unable to load asset details.");
      }
      setAsset(payload.data);
      setUpdatedAt(payload.updatedAt ?? null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load asset details.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id, selectedRange]);

  useEffect(() => {
    void loadDetail();
    const refresh = window.setInterval(() => {
      void loadDetail();
    }, 3_000);
    return () => window.clearInterval(refresh);
  }, [loadDetail]);

  useEffect(() => {
    void logAnalyticsEvent("crypto_detail_viewed", {
      route: `/markets/crypto/${id}`,
      asset_id: id,
    });
  }, [id]);

  const chartPoints = asset?.chart ?? [];
  const up = (asset?.change24h ?? 0) >= 0;

  if (loading) {
    return (
      <div style={{ background: palette.bg }}>
        <div
          className="perch-shell"
          style={{ paddingTop: "clamp(24px, 5vw, 36px)", paddingBottom: "clamp(48px, 10vw, 72px)", color: palette.muted }}
        >
          Loading crypto detail...
        </div>
      </div>
    );
  }

  if (!asset || error) {
    return (
      <div style={{ background: palette.bg }}>
        <div
          className="perch-shell"
          style={{ paddingTop: "clamp(24px, 5vw, 36px)", paddingBottom: "clamp(48px, 10vw, 72px)" }}
        >
          <Link
            href="/markets/crypto"
            style={{
              color: palette.muted,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
              display: "inline-flex",
              minHeight: 44,
              alignItems: "center",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {"← Back to Live Crypto"}
          </Link>
          <div
            style={{
              marginTop: 16,
              border: `1px solid ${palette.border}`,
              borderRadius: 14,
              padding: "14px 16px",
              background: "#FFF8F6",
              color: "#A3452F",
              fontSize: 14,
            }}
          >
            {error || "This asset is currently unavailable."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: palette.bg }}>
      <div
        className="perch-shell"
        style={{ paddingTop: "clamp(24px, 5vw, 36px)", paddingBottom: "clamp(48px, 10vw, 72px)" }}
      >
        <Link
          href="/markets/crypto"
          style={{
            color: palette.muted,
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
            display: "inline-flex",
            minHeight: 44,
            alignItems: "center",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {"← Back to Live Crypto"}
        </Link>

        <section
          style={{
            marginTop: 14,
            border: `1px solid ${palette.border}`,
            borderRadius: 20,
            background:
              "radial-gradient(circle at top right, rgba(255,122,26,0.12), rgba(255,255,255,0.97) 35%), linear-gradient(145deg, #FFFFFF 12%, #F8FAFF 92%)",
            boxShadow: "0 14px 34px rgba(18, 29, 56, 0.08)",
            padding: "clamp(18px, 4vw, 24px) clamp(16px, 4vw, 22px)",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: palette.orange, fontWeight: 700 }}>{asset.symbol}</p>
          <h1
            style={{
              margin: "8px 0 0",
              color: palette.text,
              fontSize: "clamp(24px, 5.5vw, 42px)",
              lineHeight: 1.12,
            }}
          >
            {asset.name}
          </h1>
          <p
            style={{
              margin: "12px 0 0",
              color: palette.text,
              fontSize: "clamp(28px, 7vw, 44px)",
              fontWeight: 740,
              lineHeight: 1.1,
            }}
          >
            {formatUsd(asset.price)}
          </p>
          <p style={{ marginTop: 6, color: up ? palette.green : palette.red, fontWeight: 650 }}>
            24h: {formatPercent(asset.change24h)}
          </p>
          <p style={{ marginTop: 8, marginBottom: 0, color: palette.muted, fontSize: 13 }}>
            {updatedAt
              ? `Last updated ${new Date(updatedAt).toLocaleTimeString("en-US")}`
              : "Live update active"}
          </p>
        </section>

        <section
          style={{
            marginTop: 14,
            border: `1px solid ${palette.border}`,
            borderRadius: 18,
            background: "linear-gradient(145deg, #FFFFFF 10%, #F5F8FF 90%)",
            boxShadow: "0 16px 36px rgba(16, 29, 59, 0.09)",
            padding: "clamp(14px, 3vw, 18px)",
            minHeight: 340,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, color: palette.muted, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>
                PRICE ACTION
              </p>
              <p style={{ margin: "4px 0 0", color: palette.text, fontSize: 14, fontWeight: 650 }}>
                {selectedRange} Trend View
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {RANGE_OPTIONS.map((range) => {
                const active = range === selectedRange;
                return (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setSelectedRange(range)}
                    style={{
                      borderRadius: 999,
                      border: active ? "1px solid #1B2A4B" : "1px solid #CFD8EC",
                      background: active ? "#1B2A4B" : "#FFFFFF",
                      color: active ? "#F4F7FF" : "#425175",
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      cursor: "pointer",
                    }}
                  >
                    {range}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="perch-crypto-chart-wrap" style={{ width: "100%", marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartPoints} margin={{ top: 10, right: 10, left: 0, bottom: 6 }}>
                <XAxis
                  dataKey="timestamp"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#5D6A86", fontSize: 11 }}
                  tickFormatter={(value: string) =>
                    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }
                  minTickGap={24}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#5D6A86", fontSize: 11 }}
                  tickFormatter={formatAxisPrice}
                  width={62}
                />
                <Tooltip
                  contentStyle={{
                    background: "#FFFFFF",
                    border: `1px solid ${palette.border}`,
                    borderRadius: 10,
                    boxShadow: "0 8px 18px rgba(22,33,61,0.12)",
                  }}
                  formatter={(value: number) => [formatUsd(value), "Price"]}
                  labelFormatter={(value: string) =>
                    new Date(value).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })
                  }
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={palette.orange}
                  strokeWidth={2.8}
                  dot={false}
                  activeDot={{ r: 4, fill: palette.orange }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="perch-crypto-detail-stats" style={{ marginTop: 14 }}>
          {[
            { label: "Current Price", value: formatUsd(asset.price) },
            { label: "24h Change", value: formatPercent(asset.change24h) },
            { label: "Volume (24h)", value: formatCompact(asset.volume24h) },
            { label: "Quote Volume (24h)", value: formatCompact(asset.quoteVolume24h) },
            { label: "24h High", value: formatUsd(asset.high24h) },
            { label: "24h Low", value: formatUsd(asset.low24h) },
            { label: "Snapshot Time", value: asset.updateTime ? new Date(asset.updateTime).toLocaleString("en-US") : "N/A" },
          ].map((item) => (
            <article
              key={item.label}
              style={{
                border: `1px solid ${palette.border}`,
                borderRadius: 12,
                background: "#FFFFFF",
                padding: "clamp(12px, 3vw, 14px) clamp(10px, 3vw, 12px)",
              }}
            >
              <p style={{ margin: 0, color: palette.muted, fontSize: 12 }}>{item.label}</p>
              <p
                style={{
                  margin: "8px 0 0",
                  color: palette.text,
                  fontSize: "clamp(15px, 3.5vw, 18px)",
                  fontWeight: 650,
                  wordBreak: "break-word",
                }}
              >
                {item.value}
              </p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
