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

const palette = {
  orange: "#C45000",
  bg: "#FFFFFF",
  border: "#E8E8E8",
  text: "#1A1A1A",
  muted: "#6B6B6B",
} as const;

type DetailResponse = {
  data?: LiveMarketDetail;
  updatedAt?: string;
  error?: string;
};

function formatUsd(value: number | null) {
  if (value === null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatCompact(value: number | null) {
  if (value === null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function CryptoDetailExperience({ id }: { id: string }) {
  const [asset, setAsset] = useState<LiveMarketDetail | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    try {
      const response = await fetch(`/api/live-markets/${id}`, { cache: "no-store" });
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
  }, [id]);

  useEffect(() => {
    void loadDetail();
    const refresh = window.setInterval(() => {
      void loadDetail();
    }, 45_000);
    return () => window.clearInterval(refresh);
  }, [loadDetail]);

  if (loading) {
    return (
      <div style={{ background: palette.bg }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "36px 32px 72px", color: palette.muted }}>
          Loading crypto detail...
        </div>
      </div>
    );
  }

  if (!asset || error) {
    return (
      <div style={{ background: palette.bg }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "36px 32px 72px" }}>
          <Link href="/markets/crypto" style={{ color: palette.muted, textDecoration: "none", fontSize: 13 }}>
            {"<- Back to Live Crypto"}
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

  const up = (asset.change24h ?? 0) >= 0;

  return (
    <div style={{ background: palette.bg }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "36px 32px 72px" }}>
        <Link href="/markets/crypto" style={{ color: palette.muted, textDecoration: "none", fontSize: 13 }}>
          {"<- Back to Live Crypto"}
        </Link>

        <section
          style={{
            marginTop: 14,
            border: `1px solid ${palette.border}`,
            borderRadius: 18,
            background: "#FFFFFF",
            padding: "24px 22px",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: palette.orange, fontWeight: 700 }}>{asset.symbol}</p>
          <h1 style={{ margin: "8px 0 0", color: palette.text, fontSize: 42, lineHeight: 1.1 }}>{asset.name}</h1>
          <p style={{ margin: "12px 0 0", color: palette.text, fontSize: 44, fontWeight: 740 }}>
            {formatUsd(asset.price)}
          </p>
          <p style={{ marginTop: 6, color: up ? "#007A4C" : "#C0392B", fontWeight: 650 }}>
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
            borderRadius: 16,
            background: "#FFFFFF",
            padding: 16,
            height: 360,
          }}
        >
          <div style={{ color: palette.muted, fontSize: 12, fontWeight: 700 }}>7D Price Trend</div>
          <div style={{ width: "100%", height: 310, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={asset.chart}>
                <XAxis
                  dataKey="timestamp"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: palette.muted, fontSize: 11 }}
                  tickFormatter={(value: string) =>
                    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: palette.muted, fontSize: 11 }}
                  tickFormatter={(value: number) => `${Math.round(value)}`}
                  width={56}
                />
                <Tooltip
                  contentStyle={{
                    background: "#FFFFFF",
                    border: `1px solid ${palette.border}`,
                    borderRadius: 8,
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
                <Line type="monotone" dataKey="price" stroke={palette.orange} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {[
            { label: "Market Cap", value: formatCompact(asset.marketCap) },
            { label: "Volume (24h)", value: formatCompact(asset.volume24h) },
            { label: "Rank", value: asset.rank ? `#${asset.rank}` : "N/A" },
            { label: "24h High", value: formatUsd(asset.high24h) },
            { label: "24h Low", value: formatUsd(asset.low24h) },
            { label: "Circulating Supply", value: asset.circulatingSupply ? asset.circulatingSupply.toLocaleString("en-US") : "N/A" },
            { label: "All Time High", value: formatUsd(asset.ath) },
            { label: "ATH Delta", value: formatPercent(asset.athChangePercentage) },
            { label: "Snapshot Time", value: asset.lastUpdated ? new Date(asset.lastUpdated).toLocaleString("en-US") : "N/A" },
          ].map((item) => (
            <article
              key={item.label}
              style={{
                border: `1px solid ${palette.border}`,
                borderRadius: 12,
                background: "#FFFFFF",
                padding: "14px 12px",
              }}
            >
              <p style={{ margin: 0, color: palette.muted, fontSize: 12 }}>{item.label}</p>
              <p style={{ margin: "8px 0 0", color: palette.text, fontSize: 18, fontWeight: 650 }}>{item.value}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
