"use client";

import {
  seedRemotePortfolioFromBundle,
  upsertProfileRow,
} from "@/app/actions/portfolio";
import { AuthShell } from "@/components/auth/AuthShell";
import styles from "@/components/auth/AuthShell.module.css";
import { usePortfolio } from "@/components/PortfolioProvider";
import {
  friendlyAuthError,
  normalizeUsername,
  usernameToEmail,
  validatePasswordFormat,
  validateUsernameFormat,
} from "@/lib/perchAuthEmail";
import { clearGuestPortfolioStorage, getGuestPortfolioBundle } from "@/lib/portfolioStore";
import { createClient } from "@/utils/supabase/client";
import { linkAuthenticatedAnalyticsUser, logAnalyticsEvent } from "@/lib/analytics/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

export function SignupForm() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (authLoading) return;
    if (user) router.replace("/dashboard");
  }, [user, authLoading, router]);
  const fromOnboarding = searchParams.get("from") === "onboarding";
  const nextRaw = searchParams.get("next");
  const postSignupPath =
    !fromOnboarding &&
    nextRaw &&
    nextRaw.startsWith("/") &&
    !nextRaw.startsWith("//")
      ? nextRaw
      : "/dashboard";
  const { refreshPortfolio } = usePortfolio();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const uErr = validateUsernameFormat(username);
      if (uErr) {
        setError(uErr);
        return;
      }
      const pErr = validatePasswordFormat(password);
      if (pErr) {
        setError(pErr);
        return;
      }

      const slug = normalizeUsername(username);
      const email = usernameToEmail(username);
      const supabase = createClient();

      const { data, error: signErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username: slug },
        },
      });

      if (signErr) {
        setError(friendlyAuthError(signErr.message));
        return;
      }
      if (!data.session) {
        setError(
          "Account is ready, but we could not open a session. In Supabase, turn off email confirmation for Auth on this project, then sign in."
        );
        return;
      }

      const profileRes = await upsertProfileRow({
        username: slug,
        onboardingCompleted: fromOnboarding,
      });
      if (!profileRes.ok) {
        setError(profileRes.error);
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

      // Onboarding signup awaits profile + seed + portfolio refresh before navigation.
      // Ensure PostHog alias+identify runs for this session even if auth callbacks raced that work.
      if (fromOnboarding) {
        const { data: latest } = await supabase.auth.getSession();
        const u = latest.session?.user;
        if (u) {
          linkAuthenticatedAnalyticsUser(u.id, {
            email: u.email ?? null,
            signup_method: u.app_metadata?.provider ?? null,
          });
        }
      }

      void logAnalyticsEvent("signup_completed", {
        route: "/signup",
        username: slug,
        onboarding_completed: fromOnboarding,
      });
      router.push(postSignupPath);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!authLoading && user) {
    return (
      <div className="perch-shell" style={{ paddingTop: 48, color: "#6B6B6B" }}>
        Redirecting…
      </div>
    );
  }

  return (
    <AuthShell
      kicker={fromOnboarding ? "After your first practice trade" : undefined}
      title="Create your account"
      subtitle="Save your progress and pick up where you left off. Your username is how we recognize you when you return."
      footer={
        <>
          <p className={styles.footer}>
            Already have an account?{" "}
            <Link href="/signin" className={styles.footerLink}>
              Sign in
            </Link>
          </p>
          <p className={styles.homeLink}>
            <Link href="/">Home</Link>
          </p>
          <p className={styles.footer} style={{ marginTop: 12 }}>
            Want live trading when we launch?{" "}
            <Link href="/waitlist" className={styles.footerLink}>
              Join the waitlist
            </Link>
          </p>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <div className={styles.inputGroup}>
          <label htmlFor="signup-username" className={styles.label}>
            Username
          </label>
          <input
            id="signup-username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. marketstarter"
            className={styles.input}
          />
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="signup-password" className={styles.label}>
            Password
          </label>
          <input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={styles.input}
          />
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        <button type="submit" disabled={busy} className={styles.submit}>
          {busy ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
