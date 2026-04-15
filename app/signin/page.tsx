"use client";

import { AuthShell } from "@/components/auth/AuthShell";
import styles from "@/components/auth/AuthShell.module.css";
import { usePortfolio } from "@/components/PortfolioProvider";
import {
  friendlyAuthError,
  usernameToEmail,
  validatePasswordFormat,
  validateUsernameFormat,
} from "@/lib/perchAuthEmail";
import { createClient } from "@/utils/supabase/client";
import { logAnalyticsEvent } from "@/lib/analytics/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignInPage() {
  const router = useRouter();
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
      <form onSubmit={onSubmit}>
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
