"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getStockByTicker } from "@/lib/mockData";
import { formatPKRWithSymbol } from "@/lib/format";
import {
  PRACTICE_AMOUNTS,
  STARTER_BLURBS,
  STARTER_TICKERS,
  type StarterTicker,
} from "@/lib/onboardingConstants";
import { TradeSuccessScreen } from "@/components/trade/TradeSuccessScreen";
import { startRouteProgress } from "@/lib/routeProgress";
import { logAnalyticsEvent } from "@/lib/analytics/client";
import styles from "./GuidedOnboarding.module.css";

const TOTAL_STEPS = 5;

export function GuidedOnboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tradeComplete = searchParams.get("tradeComplete") === "1";
  const tradeTickerParam = searchParams.get("ticker");
  const tradeSharesParam = Number(searchParams.get("shares"));
  const tradeInvestedParam = Number(searchParams.get("invested"));

  const [step, setStep] = useState(tradeComplete ? TOTAL_STEPS - 1 : 0);
  const [amount, setAmount] = useState<number | null>(null);
  const [ticker, setTicker] = useState<StarterTicker | null>(null);

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
                A quick setup gets you to your first pretend trade on the Pakistan Stock Exchange (PSX) using virtual
                money.
              </p>
              <div className={styles.actions}>
                <button type="button" className={styles.primaryBtn} onClick={next}>
                  Start setup
                </button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className={styles.title}>How much do you want to practice with?</h1>
              <p className={styles.subtitle}>
                This is just a planning amount. No real transfer is needed.
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

          {step === 2 && (
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

          {step === 3 && ticker && stock && (
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

          {step === 4 && tradeComplete && (
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
