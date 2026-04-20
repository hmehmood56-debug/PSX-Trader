"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePortfolio } from "@/components/PortfolioProvider";
import { logAnalyticsEvent } from "@/lib/analytics/client";
import { formatPKRWithSymbol } from "@/lib/format";
import { getOptionsOwnerKey } from "@/lib/optionsOwner";
import { purchaseSimulatedOption } from "@/lib/optionsExecution";
import {
  DEFAULT_VOL,
  OPTION_EXPIRY_PRESETS,
  approxExpiryItmRiskNeutral,
  calendarDaysUntilExpiry,
  computeOptionTicketEconomics,
  estimateContractModelValueRs,
  resolveVolatility,
  strikesAroundSpot,
} from "@/lib/optionsPricing";
import { listOptionsPositions, subscribeOptionsPositions } from "@/lib/optionsPositionsStore";
import { getReplayProfileByTicker } from "@/lib/replayDataset";

const COLORS = {
  orange: "#C45000",
  border: "#E5E5E5",
  borderStrong: "#D4D4D4",
  text: "#141414",
  muted: "#737373",
  label: "#525252",
  panel: "#FAFAFA",
  panelWarm: "linear-gradient(165deg, #FFFBF8 0%, #FFFEFD 45%, #F8F7F5 100%)",
  chartLine: "#C4A574",
  positive: "#166534",
  negative: "#9B1C1C",
} as const;

const QTY = 1;

type QuotePayload = {
  data?: {
    price?: number;
    change?: number;
    changePercent?: number;
  } | null;
};

type HistoryPayload = {
  data?: Array<{ date?: string; price?: number }>;
};

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatExpiryLabel(iso: string): string {
  try {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function TicketRow({
  label,
  value,
  emphasize,
  valueTone = "default",
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  valueTone?: "default" | "positive" | "negative" | "accent";
}) {
  const valueColor =
    valueTone === "positive"
      ? COLORS.positive
      : valueTone === "negative"
        ? COLORS.negative
        : valueTone === "accent"
          ? COLORS.orange
          : COLORS.text;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 16,
        padding: "12px 0",
        borderBottom: `1px solid rgba(196, 80, 0, 0.12)`,
        fontSize: emphasize ? 16 : 14,
      }}
    >
      <span style={{ color: COLORS.label, fontWeight: 560 }}>{label}</span>
      <span
        style={{
          fontWeight: emphasize ? 750 : 650,
          color: valueColor,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: emphasize ? "-0.02em" : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function OptionsSimulatorClient({ ticker }: { ticker: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { refreshPortfolio } = usePortfolio();
  const upper = ticker.toUpperCase();
  const profile = getReplayProfileByTicker(upper);

  const [spot, setSpot] = useState<number | null>(null);
  const [chartPoints, setChartPoints] = useState<Array<{ t: string; price: number }>>([]);
  const [volInput, setVolInput] = useState<number[]>([]);
  const [side, setSide] = useState<"call" | "put" | null>(null);
  const [strike, setStrike] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expiryDays, setExpiryDays] = useState(7);
  const [orderSuccess, setOrderSuccess] = useState<{
    ticker: string;
    contractType: string;
    strikeDisplay: string;
    expiryDisplay: string;
    costDisplay: string;
  } | null>(null);
  const positionsSectionRef = useRef<HTMLElement | null>(null);
  const [practiceRows, setPracticeRows] = useState(() =>
    listOptionsPositions(getOptionsOwnerKey(user?.id))
  );

  const viewedKey = `options_viewed_${upper}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(viewedKey)) return;
    window.sessionStorage.setItem(viewedKey, "1");
    void logAnalyticsEvent("options_viewed", { ticker: upper });
  }, [upper, viewedKey]);

  useEffect(() => {
    const owner = getOptionsOwnerKey(user?.id);
    setPracticeRows(listOptionsPositions(owner));
    return subscribeOptionsPositions(() => {
      setPracticeRows(listOptionsPositions(getOptionsOwnerKey(user?.id)));
    });
  }, [user?.id]);

  const loadMarket = useCallback(async () => {
    try {
      const [qRes, hRes] = await Promise.all([
        fetch(`/api/psx-terminal/quote/${encodeURIComponent(upper)}`, { cache: "no-store" }),
        fetch(`/api/psx-terminal/history/${encodeURIComponent(upper)}`, { cache: "no-store" }),
      ]);
      const qJson = (await qRes.json()) as QuotePayload;
      const px = qJson.data && typeof qJson.data.price === "number" ? qJson.data.price : null;
      setSpot(px);

      const hJson = (await hRes.json()) as HistoryPayload;
      const rows = Array.isArray(hJson.data) ? hJson.data : [];
      const closes = rows
        .map((r) => (typeof r.price === "number" ? r.price : null))
        .filter((n): n is number => n !== null);
      setVolInput(closes);

      const pts = rows
        .filter((r) => typeof r.price === "number")
        .slice(-48)
        .map((r, i) => ({
          t: String(i),
          price: Number(r.price!.toFixed(2)),
        }));
      setChartPoints(pts);
    } catch {
      setSpot(null);
      setChartPoints([]);
      setVolInput([]);
    }
  }, [upper]);

  useEffect(() => {
    void loadMarket();
    const id = window.setInterval(() => void loadMarket(), 15_000);
    return () => window.clearInterval(id);
  }, [loadMarket]);

  const sigma = useMemo(() => resolveVolatility(volInput), [volInput]);

  const strikes = useMemo(() => {
    if (spot === null || !(spot > 0)) return [];
    return strikesAroundSpot(spot);
  }, [spot]);

  useEffect(() => {
    if (strikes.length === 0) return;
    if (strike === null || !strikes.includes(strike)) {
      let best = strikes[0];
      let bestDist = Math.abs(best - (spot ?? best));
      for (const k of strikes) {
        const d = Math.abs(k - (spot ?? k));
        if (d < bestDist) {
          best = k;
          bestDist = d;
        }
      }
      setStrike(best);
    }
  }, [strike, spot, strikes]);

  const expiryIso = useMemo(() => addDaysIso(expiryDays), [expiryDays]);

  const ticket = useMemo(() => {
    if (spot === null || strike === null || side === null) return null;
    return computeOptionTicketEconomics({
      spot,
      strike,
      side,
      daysToExpiry: expiryDays,
      sigma,
      quantity: QTY,
    });
  }, [spot, strike, side, sigma, expiryDays]);

  const itmPct =
    spot !== null && strike !== null && side !== null
      ? approxExpiryItmRiskNeutral({
          spot,
          strike,
          side,
          daysToExpiry: expiryDays,
          sigma,
        })
      : null;

  const contractPremium = ticket?.totalDebitRs ?? 0;

  const onBuy = async () => {
    if (spot === null || strike === null || side === null) {
      setStatus("Select contract type and strike.");
      return;
    }
    setBusy(true);
    setStatus(null);
    setOrderSuccess(null);
    const res = await purchaseSimulatedOption({
      userId: user?.id,
      isAuthenticated: Boolean(user),
      ticker: upper,
      side,
      strike,
      expiry: expiryIso,
      premiumPaid: contractPremium,
      quantity: QTY,
    });
    setBusy(false);
    if (!res.ok) {
      setStatus(res.error);
      return;
    }
    void logAnalyticsEvent("option_trade_executed", {
      ticker: upper,
      side,
      strike,
      premium_paid: contractPremium,
    });
    if (user) {
      await refreshPortfolio();
    }
    setOrderSuccess({
      ticker: upper,
      contractType: side === "call" ? "Call" : "Put",
      strikeDisplay: formatPKRWithSymbol(strike, { maximumFractionDigits: 2 }),
      expiryDisplay: formatExpiryLabel(expiryIso),
      costDisplay: formatPKRWithSymbol(contractPremium, { maximumFractionDigits: 0 }),
    });
    router.refresh();
  };

  const contractLabel = side === "call" ? "Call" : side === "put" ? "Put" : "—";
  const strikeStr =
    strike !== null ? formatPKRWithSymbol(strike, { maximumFractionDigits: 2 }) : "—";
  const optionLine = side && strike !== null ? `${upper} · ${contractLabel} · ${strikeStr}` : "—";

  return (
    <div style={{ background: "#fff" }}>
      <style>{`
        .opt-shell { max-width: 1080px; margin: 0 auto; padding-left: clamp(16px, 4vw, 24px); padding-right: clamp(16px, 4vw, 24px); }
        .opt-above-fold { display: flex; flex-direction: column; gap: 20px; }
        @media (min-width: 900px) {
          .opt-above-fold { flex-direction: row; align-items: stretch; gap: 24px; }
          .opt-chart-wrap { flex: 1 1 44%; min-width: 0; }
          .opt-ticket-wrap { flex: 1 1 56%; min-width: 0; }
        }
      `}</style>
      <div className="opt-shell perch-shell" style={{ paddingTop: 24, paddingBottom: 56 }}>
        <div style={{ marginBottom: 18 }}>
          <Link
            href="/markets/options"
            style={{ color: COLORS.muted, fontWeight: 600, textDecoration: "none", fontSize: 13 }}
          >
            ← All options
          </Link>
        </div>

        <header style={{ marginBottom: 26 }}>
          <p style={{ margin: 0, fontSize: 11, color: COLORS.orange, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.85 }}>
            PSX · Options (practice)
          </p>
          <h1
            style={{
              margin: "8px 0 0",
              fontSize: "clamp(22px, 4.5vw, 32px)",
              color: COLORS.orange,
              fontWeight: 780,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}
          >
            {profile?.name ?? upper}
            <span style={{ fontWeight: 720, opacity: 0.92 }}> · {upper}</span>
          </h1>
          <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>
            Stock price
          </p>
          <p style={{ marginTop: 6, fontSize: 30, fontWeight: 780, letterSpacing: "-0.03em", color: COLORS.text }}>
            {spot !== null ? formatPKRWithSymbol(spot) : "—"}
          </p>
        </header>

        <section style={{ marginBottom: 20 }}>
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 11,
              color: COLORS.muted,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Contract
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              type="button"
              onClick={() => setSide("call")}
              style={{
                minHeight: 50,
                padding: "0 16px",
                borderRadius: 10,
                border: `2px solid ${side === "call" ? COLORS.orange : COLORS.borderStrong}`,
                background: side === "call" ? "rgba(196, 80, 0, 0.08)" : "#fff",
                fontWeight: 750,
                fontSize: 15,
                color: COLORS.text,
                cursor: "pointer",
              }}
            >
              Call
            </button>
            <button
              type="button"
              onClick={() => setSide("put")}
              style={{
                minHeight: 50,
                padding: "0 16px",
                borderRadius: 10,
                border: `2px solid ${side === "put" ? COLORS.orange : COLORS.borderStrong}`,
                background: side === "put" ? "rgba(196, 80, 0, 0.08)" : "#fff",
                fontWeight: 750,
                fontSize: 15,
                color: COLORS.text,
                cursor: "pointer",
              }}
            >
              Put
            </button>
          </div>
        </section>

        <section style={{ marginBottom: 20 }}>
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 11,
              color: COLORS.muted,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Strike price
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {strikes.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setStrike(k)}
                style={{
                  padding: "10px 18px",
                  minHeight: 42,
                  borderRadius: 9999,
                  border: `2px solid ${strike === k ? COLORS.orange : COLORS.borderStrong}`,
                  background: strike === k ? COLORS.orange : "#fff",
                  color: strike === k ? "#fff" : COLORS.text,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  fontVariantNumeric: "tabular-nums",
                  boxShadow: strike === k ? "0 4px 14px rgba(196, 80, 0, 0.22)" : "none",
                }}
              >
                {formatPKRWithSymbol(k, { maximumFractionDigits: 2 })}
              </button>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 22 }}>
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 11,
              color: COLORS.muted,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Expiry
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {OPTION_EXPIRY_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setExpiryDays(p.days)}
                style={{
                  minHeight: 44,
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: `2px solid ${expiryDays === p.days ? COLORS.orange : COLORS.borderStrong}`,
                  background: expiryDays === p.days ? "rgba(196, 80, 0, 0.08)" : "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  color: COLORS.text,
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 15, fontWeight: 650, color: COLORS.text }}>{formatExpiryLabel(expiryIso)}</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: COLORS.muted }}>{expiryDays} days (practice calendar)</p>
        </section>

        <div className="opt-above-fold" style={{ marginBottom: 18 }}>
          {chartPoints.length > 1 && (
            <section className="opt-chart-wrap" style={{ paddingBottom: 8, borderBottom: `1px solid ${COLORS.border}` }}>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: 11,
                  color: COLORS.muted,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Recent price movement
              </p>
              <div style={{ width: "100%", height: 128 }}>
                <ResponsiveContainer>
                  <LineChart data={chartPoints}>
                    <XAxis dataKey="t" hide />
                    <YAxis domain={["auto", "auto"]} width={40} tick={{ fontSize: 10 }} stroke={COLORS.muted} />
                    <Tooltip formatter={(v: number | string) => formatPKRWithSymbol(Number(v))} />
                    <Line type="monotone" dataKey="price" stroke={COLORS.chartLine} dot={false} strokeWidth={1.75} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          <div
            className="opt-ticket-wrap"
            style={{
              border: `1px solid rgba(196, 80, 0, 0.22)`,
              borderRadius: 14,
              borderLeft: `4px solid ${COLORS.orange}`,
              background: COLORS.panelWarm,
              boxShadow: "0 8px 32px rgba(23, 23, 23, 0.06)",
              padding: "18px 20px 20px",
              alignSelf: "stretch",
            }}
          >
            <p
              style={{
                margin: "0 0 4px",
                fontSize: 11,
                color: COLORS.orange,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Order ticket
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: COLORS.label, lineHeight: 1.45, fontWeight: 650 }}>
              {optionLine}
            </p>

            <TicketRow
              label="Stock price"
              value={spot !== null ? formatPKRWithSymbol(spot) : "—"}
              emphasize
              valueTone="accent"
            />
            <TicketRow label="Contract type" value={contractLabel} />
            <TicketRow label="Strike" value={strike !== null ? formatPKRWithSymbol(strike, { maximumFractionDigits: 2 }) : "—"} />
            <TicketRow label="Expiry" value={formatExpiryLabel(expiryIso)} />

            {ticket && (
              <>
                <TicketRow
                  label="Break-even"
                  value={formatPKRWithSymbol(ticket.breakEvenUnderlying, { maximumFractionDigits: 2 })}
                />
                {itmPct !== null && (
                  <TicketRow
                    label="Chance of finishing in the money"
                    value={`${(itmPct * 100).toFixed(0)}%`}
                  />
                )}
                <div style={{ padding: "14px 0 0", borderTop: `1px solid rgba(196, 80, 0, 0.18)`, marginTop: 6 }}>
                  <TicketRow
                    label="Cost / max loss"
                    value={formatPKRWithSymbol(ticket.totalDebitRs, { maximumFractionDigits: 0 })}
                    emphasize
                    valueTone="negative"
                  />
                </div>
              </>
            )}

            {(!ticket || spot === null) && (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: COLORS.muted, lineHeight: 1.55 }}>
                Choose Call or Put and wait for a live stock price.
              </p>
            )}
          </div>
        </div>

        <p style={{ margin: "0 0 14px", fontSize: 11, color: COLORS.muted, lineHeight: 1.45 }}>
          Practice exercise at expiry. Marks use the same model as the ticket—not an exchange quote.
        </p>

        {status && (
          <p style={{ color: "#b91c1c", marginBottom: 12, fontSize: 14 }} role="alert">
            {status}
          </p>
        )}

        <button
          type="button"
          disabled={busy || spot === null || strike === null || side === null || !ticket}
          onClick={() => void onBuy()}
          style={{
            width: "100%",
            minHeight: 54,
            borderRadius: 10,
            border: "none",
            background: COLORS.orange,
            color: "#fff",
            fontWeight: 750,
            fontSize: 16,
            cursor: busy ? "wait" : "pointer",
            opacity: busy || !ticket ? 0.45 : 1,
          }}
        >
          {busy ? "Submitting…" : "Buy to open"}
        </button>

        {orderSuccess && (
          <div
            role="status"
            style={{
              marginTop: 18,
              borderRadius: 14,
              border: "1px solid rgba(22, 101, 52, 0.28)",
              borderLeft: `4px solid #15803d`,
              background: "linear-gradient(165deg, #f0fdf4 0%, #fff 55%)",
              padding: "18px 20px 20px",
              boxShadow: "0 10px 36px rgba(22, 101, 52, 0.08)",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#15803d" }}>
              Order confirmed
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 18, fontWeight: 780, color: COLORS.text, letterSpacing: "-0.02em" }}>
              You bought {orderSuccess.contractType.toLowerCase()} options on {orderSuccess.ticker}
            </p>
            <dl
              style={{
                margin: "14px 0 0",
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "8px 20px",
                fontSize: 14,
                color: COLORS.label,
              }}
            >
              <dt style={{ margin: 0, fontWeight: 600 }}>Ticker</dt>
              <dd style={{ margin: 0, fontWeight: 700, color: COLORS.text }}>{orderSuccess.ticker}</dd>
              <dt style={{ margin: 0, fontWeight: 600 }}>Contract</dt>
              <dd style={{ margin: 0, fontWeight: 700, color: COLORS.text }}>{orderSuccess.contractType}</dd>
              <dt style={{ margin: 0, fontWeight: 600 }}>Strike</dt>
              <dd style={{ margin: 0, fontWeight: 700, color: COLORS.text }}>{orderSuccess.strikeDisplay}</dd>
              <dt style={{ margin: 0, fontWeight: 600 }}>Expiry</dt>
              <dd style={{ margin: 0, fontWeight: 700, color: COLORS.text }}>{orderSuccess.expiryDisplay}</dd>
              <dt style={{ margin: 0, fontWeight: 600 }}>Cost paid</dt>
              <dd style={{ margin: 0, fontWeight: 750, color: COLORS.orange }}>{orderSuccess.costDisplay}</dd>
            </dl>
            <p style={{ margin: "12px 0 0", fontSize: 12, color: COLORS.muted, lineHeight: 1.45 }}>
              Debit applied to your practice cash balance.
            </p>
            <button
              type="button"
              onClick={() => {
                positionsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              style={{
                marginTop: 16,
                width: "100%",
                minHeight: 46,
                borderRadius: 10,
                border: `2px solid ${COLORS.orange}`,
                background: "#fff",
                color: COLORS.orange,
                fontWeight: 750,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              View positions
            </button>
          </div>
        )}

        <section
          ref={positionsSectionRef}
          id="options-practice-positions"
          style={{ marginTop: 28, paddingTop: 18, borderTop: `1px solid ${COLORS.border}` }}
        >
          <p
            style={{
              margin: "0 0 4px",
              fontSize: 11,
              color: COLORS.muted,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Open positions (practice)
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: COLORS.muted }}>Saved on this device for your practice account.</p>
          {practiceRows.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: COLORS.muted }}>No open practice positions.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 0 }}>
              {practiceRows.map((p) => {
                const daysLeft = calendarDaysUntilExpiry(p.expiry);
                const sig = p.ticker === upper ? sigma : DEFAULT_VOL;
                const px = p.ticker === upper ? spot : null;
                const mtm =
                  px !== null
                    ? estimateContractModelValueRs({
                        spot: px,
                        strike: p.strike,
                        side: p.side,
                        daysToExpiry: daysLeft,
                        sigma: sig,
                        quantity: p.quantity,
                      })
                    : null;
                return (
                  <li
                    key={p.id}
                    style={{
                      padding: "12px 0",
                      borderBottom: `1px solid ${COLORS.border}`,
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontWeight: 700 }}>
                      <span>{p.ticker}</span>
                      <span style={{ color: COLORS.label, fontWeight: 650 }}>
                        {p.side === "call" ? "Call" : "Put"}
                      </span>
                    </div>
                    <div style={{ marginTop: 4, color: COLORS.muted, fontSize: 12 }}>
                      Strike {formatPKRWithSymbol(p.strike, { maximumFractionDigits: 2 })} · Exp {p.expiry} · Qty {p.quantity}
                    </div>
                    <div style={{ marginTop: 6, fontVariantNumeric: "tabular-nums", fontSize: 13 }}>
                      Mark (model): {mtm !== null ? formatPKRWithSymbol(mtm, { maximumFractionDigits: 0 }) : "—"}
                      {p.ticker !== upper && (
                        <span style={{ color: COLORS.muted, fontSize: 12 }}>
                          {" "}
                          · open this symbol for a live mark
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
