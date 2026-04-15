"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getStockByTicker } from "@/lib/mockData";
import { formatPKRWithSymbol } from "@/lib/format";
import {
  ONBOARDING_GOALS,
  PRACTICE_AMOUNTS,
  STARTER_BLURBS,
  STARTER_TICKERS,
  type GoalId,
  type StarterTicker,
} from "@/lib/onboardingConstants";
import { TradeSuccessScreen } from "@/components/trade/TradeSuccessScreen";
import { startRouteProgress } from "@/lib/routeProgress";
import { logAnalyticsEvent } from "@/lib/analytics/client";
import styles from "./GuidedOnboarding.module.css";

const TOTAL_STEPS = 7;

export function GuidedOnboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tradeComplete = searchParams.get("tradeComplete") === "1";
  const tradeTickerParam = searchParams.get("ticker");
  const tradeSharesParam = Number(searchParams.get("shares"));
  const tradeInvestedParam = Number(searchParams.get("invested"));

  const [step, setStep] = useState(tradeComplete ? TOTAL_STEPS - 1 : 0);
  const [goalId, setGoalId] = useState<GoalId | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [ticker, setTicker] = useState<StarterTicker | null>(null);

  const goalLabel = useMemo(() => {
    const g = ONBOARDING_GOALS.find((x) => x.id === goalId);
    return g?.title ?? "-";
  }, [goalId]);

  const stock = ticker ? getStockByTicker(ticker) : undefined;
  const successTicker = tradeTickerParam ?? ticker;
  const successStock = successTicker ? getStockByTicker(successTicker) : undefined;
  const successShares = Number.isFinite(tradeSharesParam) && tradeSharesParam > 0 ? Math.floor(tradeSharesParam) : null;
  const successInvested =
    Number.isFinite(tradeInvestedParam) && tradeInvestedParam > 0 ? tradeInvestedParam : amount;

  const progressPct = ((step + 1) / TOTAL_STEPS) * 100;
  const completionLoggedRef = useRef(false);

  useEffect(() => {
    void logAnalyticsEvent("onboarding_started", { route: "/start" });
  }, []);

  useEffect(() => {
    if (!tradeComplete || completionLoggedRef.current) return;
    completionLoggedRef.current = true;
    void logAnalyticsEvent("onboarding_completed", {
      route: "/start",
      ticker: successTicker ?? ticker ?? undefined,
      quantity: successShares ?? undefined,
      invested_amount: successInvested ?? undefined,
    });
  }, [tradeComplete, successTicker, ticker, successShares, successInvested]);

  function next() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function goEnterApp() {
    if (!ticker) return;
    startRouteProgress();
    router.push(`/stock/${ticker}?onboarding=1`);
  }

  function goToSignupAfterOnboarding() {
    startRouteProgress();
    router.push("/signup?from=onboarding");
  }

  function goToMarkets() {
    startRouteProgress();
    router.push("/markets/psx");
  }

  return (
    <div className="perch-shell">
      <div className={styles.wrap}>
        <div className={styles.topBar}>
          <Link href="/" className={styles.backLink}>
            &larr; Home
          </Link>
          <span className={styles.stepLabel}>
            Step {step + 1} of {TOTAL_STEPS}
          </span>
        </div>

        <div className={styles.progressTrack} aria-hidden>
          <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
        </div>

        <div className={styles.body}>
          {step === 0 && (
            <>
              <h1 className={styles.title}>Welcome to Perch</h1>
              <p className={styles.subtitle}>
                We will walk you through a simple practice setup. There is no quiz and no jargon - just a clear path to
                your first pretend trade on the Pakistan Stock Exchange (PSX) using virtual money.
              </p>
              <div className={styles.actions}>
                <button type="button" className={styles.primaryBtn} onClick={next}>
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className={styles.title}>What brings you here?</h1>
              <p className={styles.subtitle}>Pick the option that fits best. You can change your mind anytime.</p>
              <div className={styles.cardGrid} role="list">
                {ONBOARDING_GOALS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    role="listitem"
                    className={`${styles.optionCard} ${goalId === g.id ? styles.optionCardSelected : ""}`}
                    onClick={() => setGoalId(g.id)}
                  >
                    <div className={styles.optionTitle}>{g.title}</div>
                    <div className={styles.optionDesc}>{g.description}</div>
                  </button>
                ))}
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.primaryBtn} disabled={!goalId} onClick={next}>
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className={styles.title}>How much do you want to practice with?</h1>
              <p className={styles.subtitle}>
                This is only for planning your practice - it is not a real transfer. Your virtual account already has
                practice funds; this helps us frame your first trade.
              </p>
              <div className={styles.amountRow}>
                {PRACTICE_AMOUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`${styles.amountChip} ${amount === n ? styles.amountChipSelected : ""}`}
                    onClick={() => setAmount(n)}
                  >
                    {formatPKRWithSymbol(n, { maximumFractionDigits: 0 })}
                  </button>
                ))}
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.primaryBtn} disabled={amount == null} onClick={next}>
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className={styles.title}>Pick a starter stock</h1>
              <p className={styles.subtitle}>
                Choose one name to follow first. These are common PSX names; tap the one you want to start with.
              </p>
              <div className={styles.cardGrid}>
                {STARTER_TICKERS.map((sym) => {
                  const s = getStockByTicker(sym);
                  if (!s) return null;
                  return (
                    <button
                      key={sym}
                      type="button"
                      className={`${styles.optionCard} ${ticker === sym ? styles.optionCardSelected : ""}`}
                      onClick={() => setTicker(sym)}
                    >
                      <div className={styles.optionTitle}>
                        {sym} - {s.name}
                      </div>
                      <div className={styles.optionDesc}>{STARTER_BLURBS[sym]}</div>
                    </button>
                  );
                })}
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.primaryBtn} disabled={!ticker} onClick={next}>
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 4 && stock && amount != null && goalId && (
            <>
              <h1 className={styles.title}>Your practice summary</h1>
              <p className={styles.subtitle}>
                Here is what you chose. Everything stays virtual until you place an order on the next screens.
              </p>
              <div className={styles.previewBox}>
                <div className={styles.previewRow}>
                  <span className={styles.previewLabel}>Your focus</span>
                  <span className={styles.previewValue}>{goalLabel}</span>
                </div>
                <div className={styles.previewRow}>
                  <span className={styles.previewLabel}>Practice budget you picked</span>
                  <span className={styles.previewValue}>
                    {formatPKRWithSymbol(amount, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className={styles.previewRow}>
                  <span className={styles.previewLabel}>Starter stock</span>
                  <span className={styles.previewValue}>
                    {ticker} - {stock.name}
                  </span>
                </div>
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.primaryBtn} onClick={next}>
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 5 && ticker && stock && (
            <>
              <h1 className={styles.title}>You are set</h1>
              <p className={styles.subtitle}>
                Next, open {stock.name} ({ticker}). There you can enter how many shares to buy and complete your first
                practice purchase with virtual cash - the same steps you would use when you go live, without real money at
                risk.
              </p>
              <p className={styles.finalHint}>
                Tip: start with a small number of shares so the amounts feel easy to follow.
              </p>
              <div className={styles.actions}>
                <button type="button" className={styles.primaryBtn} onClick={goEnterApp}>
                  Open {ticker} to trade
                </button>
              </div>
            </>
          )}

          {step === 6 && tradeComplete && (
            <TradeSuccessScreen
              variant="firstTrade"
              ticker={successTicker}
              companyName={successStock?.name}
              investedAmount={successInvested}
              shares={successShares}
              primaryCta="Create account to save progress"
              onPrimary={goToSignupAfterOnboarding}
              onSecondary={goToMarkets}
            />
          )}
        </div>
      </div>
    </div>
  );
}
