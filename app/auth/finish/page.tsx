"use client";

import {
  loadRemotePortfolio,
  seedRemotePortfolioFromBundle,
  upsertProfileRow,
} from "@/app/actions/portfolio";
import { useAuth } from "@/components/auth/AuthProvider";
import { PerchWordmark } from "@/components/PerchWordmark";
import { usePortfolio } from "@/components/PortfolioProvider";
import styles from "@/components/auth/AuthShell.module.css";
import { logAnalyticsEvent } from "@/lib/analytics/client";
import { normalizeUsername } from "@/lib/perchAuthEmail";
import { clearGuestPortfolioStorage, getGuestPortfolioBundle } from "@/lib/portfolioStore";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

function buildUsername(email: string | null | undefined, userId: string): string {
  const prefix = email?.split("@")[0] ?? "";
  const normalized = normalizeUsername(prefix).slice(0, 20);
  if (normalized.length >= 3) return normalized;
  return `user_${userId.slice(0, 8)}`;
}

export default function AuthFinishPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "calc(100vh - 56px)",
            display: "grid",
            placeItems: "center",
            textAlign: "center",
          }}
        >
          Securing your workspace...
        </div>
      }
    >
      <AuthFinishClient />
    </Suspense>
  );
}

function AuthFinishClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { refreshPortfolio } = usePortfolio();
  const ranRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const mode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const source = searchParams.get("source") ?? "google";
  const onboardingCompleted = searchParams.get("onboardingCompleted") === "true";

  useEffect(() => {
    if (authLoading || ranRef.current) return;
    if (!user) {
      setError("Could not complete sign-in. Please try again.");
      return;
    }

    ranRef.current = true;
    (async () => {
      const profileRes = await loadRemotePortfolio();
      const username =
        profileRes.ok && profileRes.username ? profileRes.username : buildUsername(user.email, user.id);

      const upsertRes = await upsertProfileRow({
        username,
        onboardingCompleted: onboardingCompleted || (profileRes.ok && profileRes.onboardingCompleted),
      });
      if (!upsertRes.ok) {
        setError(upsertRes.error);
        return;
      }

      const bundle = getGuestPortfolioBundle();
      const seedRes = await seedRemotePortfolioFromBundle(bundle);
      if (!seedRes.ok) {
        setError(seedRes.error);
        return;
      }

      await refreshPortfolio();
      clearGuestPortfolioStorage();

      const eventName = mode === "signup" ? "signup_completed" : "login_completed";
      void logAnalyticsEvent(eventName, {
        route: "/auth/finish",
        provider: source,
        mode,
        username,
      });

      router.push("/dashboard");
      router.refresh();
    })();
  }, [authLoading, user, refreshPortfolio, router, mode, source, onboardingCompleted]);

  return (
    <div className={styles.finishPage}>
      <div className={styles.pageGlow} aria-hidden />
      <div className={styles.pageGlow2} aria-hidden />
      <div className={styles.finishInner}>
        <div className={styles.finishBrand}>
          <PerchWordmark compact />
        </div>
        <h1 className={styles.finishTitle}>Securing your workspace</h1>
        <p className={styles.finishSubtitle}>
          We&apos;re connecting your account and restoring your portfolio.
        </p>
        <div className={styles.finishProgress} aria-hidden>
          <div className={styles.finishProgressBar} />
        </div>
        {error ? (
          <p className={styles.finishError}>{error} Please return to sign in and try again.</p>
        ) : null}
      </div>
    </div>
  );
}
