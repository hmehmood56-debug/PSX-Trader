"use server";

import { createClient } from "@/utils/supabase/server";
import {
  applyBuy,
  applyDeposit,
  applySell,
  applyWithdraw,
  emptyBundle,
} from "@/lib/portfolioMutations";
import type { PortfolioBundle } from "@/lib/portfolioTypes";
import { normalizeUsername } from "@/lib/perchAuthEmail";

type LoadResult =
  | {
      ok: true;
      bundle: PortfolioBundle;
      onboardingCompleted: boolean;
      username: string | null;
    }
  | { ok: false; error: string };

type MutationResult =
  | { ok: true; bundle: PortfolioBundle }
  | { ok: false; error: string };

function clampBundle(b: PortfolioBundle): PortfolioBundle {
  return {
    portfolio: {
      cash: Number.isFinite(b.portfolio.cash) ? b.portfolio.cash : 1_000_000,
      holdings: Array.isArray(b.portfolio.holdings)
        ? b.portfolio.holdings
            .filter((h) => h && typeof h.ticker === "string")
            .map((h) => ({
              ticker: String(h.ticker).toUpperCase(),
              shares: Math.max(0, Math.floor(Number(h.shares) || 0)),
              avgBuyPrice: Math.max(0, Number(h.avgBuyPrice) || 0),
            }))
            .filter((h) => h.shares > 0)
        : [],
    },
    transactions: Array.isArray(b.transactions) ? b.transactions.slice(0, 500) : [],
    accountActivity: Array.isArray(b.accountActivity) ? b.accountActivity.slice(0, 200) : [],
  };
}

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase: null as ReturnType<typeof createClient> | null, user: null };
  }
  return { supabase, user };
}

async function fetchBundleForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<PortfolioBundle> {
  const { data, error } = await supabase
    .from("portfolio_snapshots")
    .select("cash, holdings, transactions, account_activity")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return emptyBundle();
  }

  const cash = typeof data.cash === "number" && Number.isFinite(data.cash) ? data.cash : 1_000_000;
  const holdings = Array.isArray(data.holdings) ? data.holdings : [];
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  const accountActivity = Array.isArray(data.account_activity) ? data.account_activity : [];

  return clampBundle({
    portfolio: { cash, holdings: holdings as PortfolioBundle["portfolio"]["holdings"] },
    transactions: transactions as PortfolioBundle["transactions"],
    accountActivity: accountActivity as PortfolioBundle["accountActivity"],
  });
}

async function persistBundle(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  bundle: PortfolioBundle
): Promise<{ ok: false; error: string } | undefined> {
  const b = clampBundle(bundle);
  const { error } = await supabase.from("portfolio_snapshots").upsert(
    {
      user_id: userId,
      cash: b.portfolio.cash,
      holdings: b.portfolio.holdings,
      transactions: b.transactions,
      account_activity: b.accountActivity,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    return { ok: false, error: error.message };
  }
  return undefined;
}

export async function loadRemotePortfolio(): Promise<LoadResult> {
  const { supabase, user } = await requireUser();
  if (!supabase || !user) {
    return { ok: false, error: "Not signed in." };
  }

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("username, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (pErr) {
    return { ok: false, error: pErr.message };
  }

  const bundle = await fetchBundleForUser(supabase, user.id);
  return {
    ok: true,
    bundle,
    onboardingCompleted: Boolean(profile?.onboarding_completed),
    username: profile?.username ?? null,
  };
}

export async function upsertProfileRow(input: {
  username: string;
  onboardingCompleted: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();
  if (!supabase || !user) {
    return { ok: false, error: "Not signed in." };
  }

  const username = normalizeUsername(input.username);
  if (username.length < 3) {
    return { ok: false, error: "Invalid username." };
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      username,
      onboarding_completed: input.onboardingCompleted,
    },
    { onConflict: "id" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function seedRemotePortfolioFromBundle(
  bundle: PortfolioBundle
): Promise<MutationResult> {
  const { supabase, user } = await requireUser();
  if (!supabase || !user) {
    return { ok: false, error: "Not signed in." };
  }

  const b = clampBundle(bundle);
  const err = await persistBundle(supabase, user.id, b);
  if (err) return err;
  return { ok: true, bundle: b };
}

export async function remoteBuyStock(
  ticker: string,
  shares: number,
  price: number
): Promise<MutationResult> {
  const { supabase, user } = await requireUser();
  if (!supabase || !user) {
    return { ok: false, error: "Not signed in." };
  }

  const bundle = await fetchBundleForUser(supabase, user.id);
  const { result, bundle: next } = applyBuy(bundle, ticker, shares, price);
  if (!result.ok || !next) {
    return { ok: false, error: result.ok ? "Unknown error." : result.error };
  }
  const err = await persistBundle(supabase, user.id, next);
  if (err) return err;
  return { ok: true, bundle: next };
}

export async function remoteSellStock(
  ticker: string,
  shares: number,
  price: number
): Promise<MutationResult> {
  const { supabase, user } = await requireUser();
  if (!supabase || !user) {
    return { ok: false, error: "Not signed in." };
  }

  const bundle = await fetchBundleForUser(supabase, user.id);
  const { result, bundle: next } = applySell(bundle, ticker, shares, price);
  if (!result.ok || !next) {
    return { ok: false, error: result.ok ? "Unknown error." : result.error };
  }
  const err = await persistBundle(supabase, user.id, next);
  if (err) return err;
  return { ok: true, bundle: next };
}

export async function remoteDepositVirtualFunds(
  amount: number,
  method = "Manual Deposit"
): Promise<MutationResult> {
  const { supabase, user } = await requireUser();
  if (!supabase || !user) {
    return { ok: false, error: "Not signed in." };
  }

  const bundle = await fetchBundleForUser(supabase, user.id);
  const { result, bundle: next } = applyDeposit(bundle, amount, method);
  if (!result.ok || !next) {
    return { ok: false, error: result.ok ? "Unknown error." : result.error };
  }
  const err = await persistBundle(supabase, user.id, next);
  if (err) return err;
  return { ok: true, bundle: next };
}

export async function remoteWithdrawVirtualFunds(
  amount: number,
  method = "Manual Withdrawal"
): Promise<MutationResult> {
  const { supabase, user } = await requireUser();
  if (!supabase || !user) {
    return { ok: false, error: "Not signed in." };
  }

  const bundle = await fetchBundleForUser(supabase, user.id);
  const { result, bundle: next } = applyWithdraw(bundle, amount, method);
  if (!result.ok || !next) {
    return { ok: false, error: result.ok ? "Unknown error." : result.error };
  }
  const err = await persistBundle(supabase, user.id, next);
  if (err) return err;
  return { ok: true, bundle: next };
}
