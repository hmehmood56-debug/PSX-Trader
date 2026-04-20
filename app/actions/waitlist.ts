"use server";

import { createClient } from "@/utils/supabase/server";
import type { RealTradingInterestId } from "@/lib/waitlistInterest";

const ALLOWED: RealTradingInterestId[] = ["psx_stocks", "us_stocks", "crypto", "forex"];

function isAllowedInterest(v: string): v is RealTradingInterestId {
  return ALLOWED.includes(v as RealTradingInterestId);
}

export type WaitlistRow = {
  user_id: string;
  interest_type: RealTradingInterestId;
  created_at: string;
};

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

export async function getRealTradingWaitlistStatus():
  | { ok: true; row: WaitlistRow | null }
  | { ok: false; error: string } {
  const { supabase, user } = await requireUser();
  if (!supabase || !user) {
    return { ok: false, error: "Not signed in" };
  }

  const { data, error } = await supabase
    .from("real_trading_waitlist")
    .select("user_id, interest_type, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: true, row: null };
  }
  if (!isAllowedInterest(data.interest_type)) {
    return { ok: true, row: null };
  }
  return {
    ok: true,
    row: {
      user_id: data.user_id,
      interest_type: data.interest_type,
      created_at: data.created_at,
    },
  };
}

export async function joinRealTradingWaitlist(interestType: string):
  | { ok: true; alreadyMember: boolean; row: WaitlistRow }
  | { ok: false; error: string } {
  const { supabase, user } = await requireUser();
  if (!supabase || !user) {
    return { ok: false, error: "Not signed in" };
  }
  if (!isAllowedInterest(interestType)) {
    return { ok: false, error: "Invalid selection" };
  }

  const { data: existing, error: selErr } = await supabase
    .from("real_trading_waitlist")
    .select("user_id, interest_type, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) {
    return { ok: false, error: selErr.message };
  }

  if (existing && isAllowedInterest(existing.interest_type)) {
    return {
      ok: true,
      alreadyMember: true,
      row: {
        user_id: existing.user_id,
        interest_type: existing.interest_type,
        created_at: existing.created_at,
      },
    };
  }

  const { data: inserted, error: insErr } = await supabase
    .from("real_trading_waitlist")
    .insert({
      user_id: user.id,
      interest_type: interestType,
    })
    .select("user_id, interest_type, created_at")
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      const { data: row } = await supabase
        .from("real_trading_waitlist")
        .select("user_id, interest_type, created_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (row && isAllowedInterest(row.interest_type)) {
        return {
          ok: true,
          alreadyMember: true,
          row: {
            user_id: row.user_id,
            interest_type: row.interest_type,
            created_at: row.created_at,
          },
        };
      }
    }
    return { ok: false, error: insErr.message };
  }

  if (!inserted || !isAllowedInterest(inserted.interest_type)) {
    return { ok: false, error: "Could not save waitlist entry" };
  }

  return {
    ok: true,
    alreadyMember: false,
    row: {
      user_id: inserted.user_id,
      interest_type: inserted.interest_type,
      created_at: inserted.created_at,
    },
  };
}
