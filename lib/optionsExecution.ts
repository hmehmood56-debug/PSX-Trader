"use client";

import { remoteDeductCashForOptions } from "@/app/actions/optionsPaper";
import { deductGuestVirtualCash } from "@/lib/optionsGuestCash";
import { appendOptionsPosition } from "@/lib/optionsPositionsStore";
import { getOptionsOwnerKey } from "@/lib/optionsOwner";
import type { OptionsSide } from "@/lib/optionsTypes";

export type OptionsPurchaseInput = {
  userId?: string | null;
  isAuthenticated: boolean;
  ticker: string;
  side: OptionsSide;
  strike: number;
  expiry: string;
  premiumPaid: number;
  quantity: number;
};

export type OptionsPurchaseResult =
  | { ok: true }
  | { ok: false; error: string };

export async function purchaseSimulatedOption(
  input: OptionsPurchaseInput
): Promise<OptionsPurchaseResult> {
  const { isAuthenticated, premiumPaid } = input;
  const ownerKey = getOptionsOwnerKey(input.userId);
  if (!Number.isFinite(premiumPaid) || premiumPaid <= 0) {
    return { ok: false, error: "Invalid premium." };
  }

  if (isAuthenticated) {
    const res = await remoteDeductCashForOptions(premiumPaid);
    if (!res.ok) return res;
  } else {
    const res = deductGuestVirtualCash(premiumPaid);
    if (!res.ok) return res;
  }

  appendOptionsPosition(ownerKey, {
    ticker: input.ticker.toUpperCase(),
    side: input.side,
    strike: input.strike,
    expiry: input.expiry,
    premiumPaid: input.premiumPaid,
    quantity: input.quantity,
  });

  return { ok: true };
}
