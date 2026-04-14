"use client";

import { useEffect, useMemo } from "react";
import { formatPKRWithSymbol } from "@/lib/format";
import styles from "./TradeSuccessScreen.module.css";

type TradeSuccessVariant = "firstTrade" | "standard";

type TradeSuccessScreenProps = {
  variant: TradeSuccessVariant;
  ticker?: string | null;
  companyName?: string | null;
  investedAmount?: number | null;
  shares?: number | null;
  side?: "BUY" | "SELL" | null;
  timestampLabel?: string | null;
  modeLabel?: string | null;
  onPrimary: () => void;
  onSecondary: () => void;
  onAutoRedirect?: () => void;
  autoRedirectMs?: number;
};

type SummaryRow = { label: string; value: string };

function FirstTradeGrowthIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" aria-hidden>
      <path
        d="M4 17L9 12L12.5 15.5L20 8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 8H20V12.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 20H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.1" />
      <path
        d="M8 12.2L10.8 15L16 9.8"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TradeSuccessScreen({
  variant,
  ticker,
  companyName,
  investedAmount,
  shares,
  side,
  timestampLabel,
  modeLabel,
  onPrimary,
  onSecondary,
  onAutoRedirect,
  autoRedirectMs = 2500,
}: TradeSuccessScreenProps) {
  useEffect(() => {
    if (variant !== "standard" || !onAutoRedirect) return;
    const timer = window.setTimeout(() => onAutoRedirect(), autoRedirectMs);
    return () => window.clearTimeout(timer);
  }, [variant, onAutoRedirect, autoRedirectMs]);

  const rows = useMemo<SummaryRow[]>(() => {
    const builtRows: SummaryRow[] = [];
    if (ticker && companyName) {
      builtRows.push({ label: "Stock", value: `${ticker} - ${companyName}` });
    }
    if (variant === "firstTrade") {
      if (Number.isFinite(investedAmount) && (investedAmount ?? 0) > 0) {
        builtRows.push({
          label: "Amount invested",
          value: formatPKRWithSymbol(investedAmount as number, { maximumFractionDigits: 0 }),
        });
      }
      if (Number.isFinite(shares) && (shares ?? 0) > 0) {
        builtRows.push({ label: "Estimated shares", value: `${Math.floor(shares as number)}` });
      }
      builtRows.push({ label: "Trade type", value: "Practice (virtual money)" });
      return builtRows;
    }

    if (Number.isFinite(shares) && (shares ?? 0) > 0) {
      builtRows.push({ label: "Shares", value: `${Math.floor(shares as number)}` });
    }
    if (Number.isFinite(investedAmount) && (investedAmount ?? 0) > 0) {
      builtRows.push({ label: "Total amount", value: formatPKRWithSymbol(investedAmount as number) });
    }
    if (side) {
      builtRows.push({ label: "Side", value: side === "BUY" ? "Buy" : "Sell" });
    }
    if (timestampLabel) {
      builtRows.push({ label: "Time", value: timestampLabel });
    }
    if (modeLabel) {
      builtRows.push({ label: "Mode", value: modeLabel });
    }
    return builtRows;
  }, [ticker, companyName, variant, investedAmount, shares, side, timestampLabel, modeLabel]);

  const title = variant === "firstTrade" ? "You made your first investment" : "Trade confirmed";
  const body =
    variant === "firstTrade"
      ? "Great job. You just made your first practice investment using virtual money, so you can learn how investing works without risking real cash."
      : "Your order was successfully completed.";
  const subtext = variant === "firstTrade" ? "You are officially building your portfolio." : null;
  const primaryCta = variant === "firstTrade" ? "Go to Dashboard" : "View Portfolio";
  const secondaryCta = variant === "firstTrade" ? "Explore More Stocks" : "Continue Browsing";

  return (
    <div className={styles.wrap}>
      <div className={styles.iconCircle} aria-hidden>
        {variant === "firstTrade" ? <FirstTradeGrowthIcon /> : <CheckCircleIcon />}
      </div>
      {variant === "firstTrade" && <div className={styles.badge}>First Milestone</div>}
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.body}>{body}</p>
      {subtext && <p className={styles.subtext}>{subtext}</p>}

      {rows.length > 0 && (
        <div className={styles.summaryCard}>
          <div className={styles.summaryTitle}>Trade summary</div>
          <div className={styles.summaryRows}>
            {rows.map((row) => (
              <div className={styles.summaryRow} key={`${row.label}-${row.value}`}>
                <span className={styles.summaryLabel}>{row.label}</span>
                <span className={styles.summaryValue}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.primaryBtn} onClick={onPrimary}>
          {primaryCta}
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={onSecondary}>
          {secondaryCta}
        </button>
      </div>

      {variant === "standard" && onAutoRedirect && (
        <p className={styles.redirectHint}>Redirecting to your portfolio...</p>
      )}
    </div>
  );
}
