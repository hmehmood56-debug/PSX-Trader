"use server";

import { createClient } from "@/utils/supabase/server";
import { emptyBundle } from "@/lib/portfolioMutations";
import type { PortfolioBundle } from "@/lib/portfolioTypes";

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

export async function remoteDeductCashForOptions(
  amount: number
): Promise<{ ok: true; newCash: number } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();
  if (!supabase || !user) {
    return { ok: false, error: "Not signed in." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Invalid amount." };
  }

  const bundle = await fetchBundleForUser(supabase, user.id);
  if (bundle.portfolio.cash + 1e-9 < amount) {
    return { ok: false, error: "Insufficient virtual cash." };
  }

  const next: PortfolioBundle = {
    ...bundle,
    portfolio: {
      ...bundle.portfolio,
      cash: Number((bundle.portfolio.cash - amount).toFixed(2)),
    },
  };

  const err = await persistBundle(supabase, user.id, next);
  if (err) return err;
  return { ok: true, newCash: next.portfolio.cash };
}
