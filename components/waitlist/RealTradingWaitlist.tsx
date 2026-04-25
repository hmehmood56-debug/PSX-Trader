"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { joinRealTradingWaitlist, getRealTradingWaitlistStatus } from "@/app/actions/waitlist";
import { useAuth } from "@/components/auth/AuthProvider";
import { logAnalyticsEvent } from "@/lib/analytics/client";
import { REAL_TRADING_INTEREST_OPTIONS, type RealTradingInterestId } from "@/lib/waitlistInterest";
import styles from "./RealTradingWaitlist.module.css";

const BUILDING_POINTS: { title: string; body: string }[] = [
  {
    title: "Simpler trading experience",
    body: "Fewer steps from intent to execution, with clear choices at each step.",
  },
  {
    title: "Real market access",
    body: "Live pricing and execution for the markets you already follow in Perch.",
  },
  {
    title: "Beginner-friendly design",
    body: "The same layout you use for practice, extended to real accounts when we launch.",
  },
  {
    title: "Built for speed and clarity",
    body: "Fast and clean workflows that stay out of your way.",
  },
];

const SIGNUP_WITH_RETURN = "/signup?next=/waitlist";

type SuccessVariant = "confirmed" | "returning" | "already";
const WAITLIST_CONTACT_LINE = (
  <>
    Questions or partnerships?{" "}
    <a href="mailto:hello@joinperch.me" style={{ color: "inherit" }}>
      hello@joinperch.me
    </a>
  </>
);

export function RealTradingWaitlist() {
  const { user, loading } = useAuth();
  const [interest, setInterest] = useState<RealTradingInterestId | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membership, setMembership] = useState<{
    interest_type: RealTradingInterestId;
  } | null>(null);
  const [successVariant, setSuccessVariant] = useState<SuccessVariant>("confirmed");
  const [joinBusy, setJoinBusy] = useState(false);
  /** Explicit: show success layout (not derived from fragile combos). */
  const [showSuccessView, setShowSuccessView] = useState(false);
  /** Prevents a slow initial status fetch from clearing state after a successful join in-session. */
  const joinCompletedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setMembership(null);
      setShowSuccessView(false);
      setMembershipLoading(false);
      joinCompletedRef.current = false;
      return;
    }
    let cancelled = false;
    setMembershipLoading(true);
    void getRealTradingWaitlistStatus().then((res) => {
      if (cancelled) return;
      setMembershipLoading(false);
      if (res.ok && res.row) {
        setMembership({ interest_type: res.row.interest_type });
        setSuccessVariant("returning");
        setShowSuccessView(true);
      } else if (!joinCompletedRef.current) {
        setMembership(null);
        setShowSuccessView(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function handleJoinClick() {
    if (!interest || !user) return;
    setJoinBusy(true);
    try {
      const res = await joinRealTradingWaitlist(interest);
      if (!res.ok) {
        return;
      }
      joinCompletedRef.current = true;
      setMembership({ interest_type: res.row.interest_type });
      setShowSuccessView(true);
      if (res.alreadyMember) {
        setSuccessVariant("already");
      } else {
        setSuccessVariant("confirmed");
        void logAnalyticsEvent("real_trading_waitlist_joined", {
          route: "/waitlist",
          interest_type: res.row.interest_type,
        });
      }
    } finally {
      setJoinBusy(false);
    }
  }

  const selectedLabel =
    membership != null
      ? REAL_TRADING_INTEREST_OPTIONS.find((o) => o.id === membership.interest_type)?.label ??
        membership.interest_type
      : interest != null
        ? REAL_TRADING_INTEREST_OPTIONS.find((o) => o.id === interest)?.label ?? interest
        : null;

  const showSuccess = showSuccessView && membership != null;

  if (showSuccess) {
    const isAlreadyCopy = successVariant === "already";
    const isReturning = successVariant === "returning";
    return (
      <div className={styles.page}>
        <div className={styles.successShell} role="status">
          <div className={styles.successAccent} aria-hidden />
          <div className={styles.successInner}>
            <div className={styles.successIcon} aria-hidden>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                <path
                  d="M8 12.2L10.8 15L16 9.8"
                  stroke="currentColor"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className={styles.successKicker}>{isAlreadyCopy ? "Waitlist" : "Confirmed"}</p>
            <h2 className={styles.successTitle}>
              {isAlreadyCopy ? "You are already on the list." : "You are on the list"}
            </h2>
            <p className={styles.successBody}>
              {isAlreadyCopy
                ? "We will contact you when real trading is ready."
                : isReturning
                  ? "We have your spot saved. We will notify you when real trading goes live."
                  : "We will notify you when real trading goes live."}
            </p>
            {!isAlreadyCopy ? (
              <p className={styles.successPriority}>Early users will get priority access.</p>
            ) : null}
            <p className={styles.successInterest}>
              Your focus: <strong>{selectedLabel ?? membership.interest_type}</strong>
            </p>
            <div className={styles.successActions}>
              <Link href="/markets" className={styles.successPrimaryLink}>
                Back to markets
              </Link>
            </div>
          </div>
        </div>
        <p className={styles.footerNote}>
          Perch paper trading is unchanged. This list is only for future live brokerage features.
          {" "}{WAITLIST_CONTACT_LINE}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden />
        <p className={styles.kicker}>Perch · Real brokerage</p>
        <h1 className={styles.title}>Real Trading is Coming to Perch</h1>
        <p className={styles.lead}>
          We are building a path from practice to live markets. Simpler flows, faster access to the assets you care
          about, and a steady workspace when prices move.
        </p>
      </header>

      <section className={styles.buildingSection} aria-labelledby="waitlist-building-heading">
        <h2 id="waitlist-building-heading" className={styles.buildingHeading}>
          What we are building
        </h2>
        <p className={styles.buildingIntro}>
          Paper trading stays the place to learn. Live trading will add real execution, starting with the markets
          waitlist users ask for most.
        </p>
        <ul className={styles.featureGrid}>
          {BUILDING_POINTS.map((item) => (
            <li key={item.title} className={styles.featureCard}>
              <span className={styles.featureAccent} aria-hidden />
              <h3 className={styles.featureTitle}>{item.title}</h3>
              <p className={styles.featureBody}>{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {loading ? (
        <p className={styles.authLoading}>Loading…</p>
      ) : !user ? (
        <div className={styles.gateCard}>
          <p className={styles.gateEyebrow}>Waitlist</p>
          <p className={styles.gateSupport}>
            Accounts created now will get priority access when real trading launches.
          </p>
          <Link href={SIGNUP_WITH_RETURN} className={styles.gateCta}>
            Create free account (no email required) to join waitlist
          </Link>
        </div>
      ) : membershipLoading ? (
        <p className={styles.authLoading}>Loading your waitlist status…</p>
      ) : (
        <>
          <div className={styles.conversionPanel}>
            <p className={styles.conversionEyebrow}>Signed in</p>
            <p className={styles.conversionTitle}>Choose what you want to trade first</p>
            <p className={styles.conversionBody}>One choice is enough. You can join the waitlist below.</p>
            <p className={styles.conversionTrust}>No spam. Product updates and launch access only.</p>
          </div>

          <div className={styles.card}>
            <p className={styles.sectionLabel}>I am most interested in</p>
            <div className={styles.options} role="radiogroup" aria-label="Trading interest">
              {REAL_TRADING_INTEREST_OPTIONS.map((opt) => {
                const selected = interest === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
                    onClick={() => setInterest(opt.id)}
                  >
                    <span className={styles.radio} aria-hidden>
                      <span className={styles.radioDot} />
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className={styles.cta}
              disabled={!interest || joinBusy}
              onClick={() => {
                void handleJoinClick();
              }}
            >
              {joinBusy ? "Saving…" : "Join the waitlist"}
            </button>
          </div>

          <p className={styles.footerNote}>
            We use your selection to prioritize rollout and keep communication focused.
            {" "}{WAITLIST_CONTACT_LINE}
          </p>
        </>
      )}
    </div>
  );
}
