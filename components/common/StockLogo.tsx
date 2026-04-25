"use client";

import { useState } from "react";
import { TICKER_DOMAIN_MAP } from "@/lib/tickerDomainMap";

const BRAND_ORANGE = "#C45000";
const BADGE_BG = "#FFF4EB";

type StockLogoProps = {
  ticker: string;
  size?: number;
};

function badgeLetters(raw: string): string {
  const t = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (t.length <= 3) return t.slice(0, 3);
  return t.slice(0, 4);
}

function logoBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_LOGO_BASE;
  if (typeof raw !== "string" || !raw.trim()) return "";
  return raw.replace(/\/+$/, "");
}

export function StockLogo({ ticker, size = 44 }: StockLogoProps) {
  const key = ticker.trim().toUpperCase();
  const domain = TICKER_DOMAIN_MAP[key];
  const base = logoBaseUrl();
  const [useFallback, setUseFallback] = useState(false);

  const canTryImage = Boolean(domain && base && !useFallback);
  const src =
    domain && base
      ? `${base}/logo?domain=${encodeURIComponent(domain)}`
      : "";

  const badge = (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: BADGE_BG,
        color: BRAND_ORANGE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: Math.max(10, Math.round(size * 0.26)),
        lineHeight: 1,
        letterSpacing: "-0.02em",
        flexShrink: 0,
        userSelect: "none",
      }}
      aria-hidden
    >
      {badgeLetters(ticker)}
    </div>
  );

  if (!canTryImage) {
    return badge;
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
        display: "block",
      }}
      onError={() => setUseFallback(true)}
    />
  );
}
