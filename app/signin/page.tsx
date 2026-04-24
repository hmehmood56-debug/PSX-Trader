"use client";

import { AuthShell } from "@/components/auth/AuthShell";
import styles from "@/components/auth/AuthShell.module.css";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePortfolio } from "@/components/PortfolioProvider";
import {
  friendlyAuthError,
  usernameToEmail,
  validatePasswordFormat,
  validateUsernameFormat,
} from "@/lib/perchAuthEmail";
import { clearGuestPortfolioStorage } from "@/lib/portfolioStore";
import { createClient } from "@/utils/supabase/client";
import { logAnalyticsEvent } from "@/lib/analytics/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignInPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { refreshPortfolio } = usePortfolio();

  useEffect(() => {
    if (authLoading) return;
    if (user) router.replace("/dashboard");
  }, [user, authLoading, router]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onGoogleAuth() {
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", "/dashboard");
      callbackUrl.searchParams.set("mode", "signin");
      callbackUrl.searchParams.set("source", "google");
      callbackUrl.searchParams.set("onboardingCompleted", "false");
      void logAnalyticsEvent("google_auth_started", {
        route: "/signin",
        mode: "signin",
      });
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl.toString() },
      });
      if (oauthError) {
        setError(friendlyAuthError(oauthError.message));
      }
    } finally {
      setBusy(false);
    }
  }

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

      const email = usernameToEmail(username);
      const supabase = createClient();

      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signErr) {
        setError(friendlyAuthError(signErr.message));
        return;
      }

      await refreshPortfolio();
      clearGuestPortfolioStorage();
      void logAnalyticsEvent("login_completed", {
        route: "/signin",
        username,
      });
      router.push("/dashboard");
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
      title="Welcome back"
      subtitle="Sign in with the same username and password to open your practice workspace."
      footer={
        <>
          <p className={styles.footer}>
            New here?{" "}
            <Link href="/signup" className={styles.footerLink}>
              Create an account
            </Link>
          </p>
          <p className={styles.homeLink}>
            <Link href="/">Home</Link>
          </p>
        </>
      }
    >
      <form onSubmit={onSubmit} className={styles.authForm}>
        <button type="button" onClick={onGoogleAuth} disabled={busy} className={styles.oauthButton}>
          <span aria-hidden className={styles.googleMark}>
            G
          </span>
          Continue with Google
        </button>
        <p className={styles.authDivider}>or use username and password</p>
        <div className={styles.inputGroup}>
          <label htmlFor="signin-username" className={styles.label}>
            Username
          </label>
          <input
            id="signin-username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. psxbeginner"
            className={styles.input}
          />
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="signin-password" className={styles.label}>
            Password
          </label>
          <input
            id="signin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
          />
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        <button type="submit" disabled={busy} className={styles.submit}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
