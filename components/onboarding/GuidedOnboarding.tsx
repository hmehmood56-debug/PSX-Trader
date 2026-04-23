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
import { StockLogo } from "@/components/common/StockLogo";
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
  const [ticker, setTicker] = useState<StarterTicker | null>("HBL");

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
            <span className={styles.stepCurrent}>{step + 1}</span>
            <span className={styles.stepDivider}> / </span>
            <span className={styles.stepTotal}>{TOTAL_STEPS}</span>
          </span>
        </div>

        <div className={styles.progressBlock}>
          <div className={styles.progressTrack} aria-hidden>
            <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className={styles.body}>
          {step === 0 && (
            <section className={styles.stepSurface}>
              <div className={styles.stepSurfaceHeader}>
                <span className={styles.stepEyebrow}>
                  <span className={styles.brandWord}>PERCH</span> Guided onboarding
                </span>
              </div>
              <div className={styles.titleWrap}>
                <span className={styles.titleRail} aria-hidden />
                <h1 className={styles.title}>
                  Your first <span className={styles.brandWordInline}>PSX</span> trade in under a minute
                </h1>
              </div>
              <p className={styles.subtitle}>
                Set up quickly and step into a real market experience using virtual capital
              </p>
              <p className={styles.flowLineMobile}>
                Start <span className={styles.flowArrow}>→</span> Choose capital <span className={styles.flowArrow}>→</span>{" "}
                Pick a stock <span className={styles.flowArrow}>→</span> Make your first trade{" "}
                <span className={styles.flowArrow}>→</span>{" "}
                <span className={styles.flowAnchor}>Create account to save progress</span>
              </p>
              <div className={styles.flowLineDesktop}>
                <span className={styles.flowStep}>Start</span>
                <span className={styles.flowStep}>Choose capital</span>
                <span className={styles.flowStep}>Pick a stock</span>
                <span className={styles.flowStep}>Make your first trade</span>
                <span className={`${styles.flowStep} ${styles.flowAnchor}`}>Create account to save progress</span>
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.primaryBtn} onClick={next}>
                  Start your first trade →
                </button>
              </div>
              <p className={styles.waitlistHint}>
                Prefer live trading later?{" "}
                <Link href="/waitlist" className={styles.waitlistLink}>
                  Join the waitlist
                </Link>
              </p>
            </section>
          )}

          {step === 1 && (
            <section className={styles.stepSurface}>
              <div className={styles.stepSurfaceHeader}>
                <span className={styles.stepEyebrow}>
                  <span className={styles.brandWord}>PERCH</span> Guided onboarding
                </span>
              </div>
              <div className={styles.titleWrap}>
                <span className={styles.titleRail} aria-hidden />
                <h1 className={styles.title}>Choose your starting capital</h1>
              </div>
              <p className={styles.subtitle}>
                This is your virtual balance for practice trading. You can change it anytime.
              </p>
              <div className={styles.amountGrid}>
                {PRACTICE_AMOUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`${styles.amountCard} ${amount === n ? styles.amountCardSelected : ""}`}
                    onClick={() => setAmount(n)}
                  >
                    <span className={styles.amountValue}>
                      <span className={styles.amountCurrency}>Rs</span>{" "}
                      {formatPKRWithSymbol(n, { maximumFractionDigits: 0 }).replace(/^Rs\.?\s*/i, "")}
                    </span>
                    <span className={styles.amountMeta}>A comfortable amount to learn live price movement</span>
                  </button>
                ))}
              </div>
              {amount != null && (
                <div className={styles.selectionPreview}>
                  <div className={styles.selectionPreviewRow}>
                    <span className={styles.selectionPreviewLabel}>Selected capital</span>
                    <span className={styles.selectionPreviewValue}>
                      {formatPKRWithSymbol(amount, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className={styles.selectionPreviewRow}>
                    <span className={styles.selectionPreviewLabel}>Real transfer</span>
                    <span className={styles.selectionPreviewValue}>None</span>
                  </div>
                  <div className={styles.selectionPreviewRow}>
                    <span className={styles.selectionPreviewLabel}>Purpose</span>
                    <span className={styles.selectionPreviewValue}>Practice only</span>
                  </div>
                </div>
              )}
              <div className={styles.actions}>
                <button type="button" className={styles.primaryBtn} disabled={amount == null} onClick={next}>
                  Proceed to pick a stock →
                </button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className={styles.stepSurface}>
              <div className={styles.stepSurfaceHeader}>
                <span className={styles.stepEyebrow}>
                  <span className={styles.brandWord}>PERCH</span> Guided onboarding
                </span>
              </div>
              <div className={styles.titleWrap}>
                <span className={styles.titleRail} aria-hidden />
                <h1 className={styles.title}>Pick a starter stock</h1>
              </div>
              <p className={styles.subtitle}>
                Choose one name to follow first. These are common PSX names; tap the one you want to start with.
              </p>
              <p className={styles.stockMicroContext}>
                Start with a well-known name to get familiar with the market
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
                      <div className={styles.optionLogoWrap}>
                        <StockLogo ticker={sym} size={44} />
                      </div>
                      <div className={styles.optionRail} aria-hidden />
                      <div className={styles.optionMain}>
                        <div className={styles.optionTickerText}>{sym}</div>
                        <div className={styles.optionCompany}>{s.name}</div>
                        <div className={styles.optionSector}>{s.sector}</div>
                        <div className={styles.optionDesc}>{STARTER_BLURBS[sym]}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.primaryBtn} disabled={!ticker} onClick={next}>
                  Review and trade →
                </button>
              </div>
            </section>
          )}

          {step === 3 && ticker && stock && (
            <section className={styles.stepSurface}>
              <div className={styles.stepSurfaceHeader}>
                <span className={styles.stepEyebrow}>
                  <span className={styles.brandWord}>PERCH</span> Guided onboarding
                </span>
              </div>
              <div className={styles.titleWrap}>
                <span className={styles.titleRail} aria-hidden />
                <h1 className={styles.title}>You are set</h1>
              </div>
              <p className={styles.subtitle}>
                Next, open {stock.name} ({ticker}). There you can enter how many shares to buy and complete your first
                practice purchase with virtual cash - the same steps you would use when you go live, without real money at
                risk.
              </p>
              <div className={styles.launchSummary}>
                <div className={styles.launchSummaryHeader}>Trade setup summary</div>
                <div className={styles.launchSummaryGrid}>
                  <div className={styles.launchSummaryRow}>
                    <span className={styles.launchSummaryLabel}>Starter stock</span>
                    <span className={styles.launchSummaryValue}>{ticker}</span>
                  </div>
                  <div className={styles.launchSummaryRow}>
                    <span className={styles.launchSummaryLabel}>Company</span>
                    <span className={styles.launchSummaryValue}>{stock.name}</span>
                  </div>
                  <div className={styles.launchSummaryRow}>
                    <span className={styles.launchSummaryLabel}>Practice capital</span>
                    <span className={styles.launchSummaryValue}>
                      {amount != null ? formatPKRWithSymbol(amount, { maximumFractionDigits: 0 }) : "Not selected"}
                    </span>
                  </div>
                  <div className={styles.launchSummaryRow}>
                    <span className={styles.launchSummaryLabel}>Next step</span>
                    <span className={styles.launchSummaryValue}>Enter shares on the stock page</span>
                  </div>
                </div>
                <p className={styles.launchHint}>
                  Tip: start with a small number of shares so the amounts feel easy to follow.
                </p>
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.primaryBtn} onClick={goEnterApp}>
                  Open {ticker} to trade
                </button>
              </div>
            </section>
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
