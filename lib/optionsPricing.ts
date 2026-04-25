export const DEFAULT_VOL = 0.3;
const RISK_FREE_ANNUAL = 0.12;
const DAYS_PER_YEAR = 365;

export const OPTION_CONTRACT_MULTIPLIER = 100;

/** Multiplier on raw Black–Scholes premium for simulator playability (still coherent with break-even). */
export const SIMULATOR_PREMIUM_SCALE = 0.88;

export const OPTION_EXPIRY_PRESETS = [
  { id: "1w", label: "1 Week", days: 7 },
  { id: "2w", label: "2 Weeks", days: 14 },
  { id: "1m", label: "1 Month", days: 30 },
] as const;

/** Cumulative distribution for standard normal (approximation). */
function normCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + p * ax);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

export function annualizedVolFromCloses(closes: number[]): number | null {
  const clean = closes.filter((c) => Number.isFinite(c) && c > 0);
  if (clean.length < 8) return null;
  const logReturns: number[] = [];
  for (let i = 1; i < clean.length; i += 1) {
    logReturns.push(Math.log(clean[i] / clean[i - 1]));
  }
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance =
    logReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / Math.max(1, logReturns.length - 1);
  const dailyVol = Math.sqrt(Math.max(variance, 0));
  if (!Number.isFinite(dailyVol) || dailyVol <= 0) return null;
  return dailyVol * Math.sqrt(DAYS_PER_YEAR);
}

export function resolveVolatility(closes: number[]): number {
  const v = annualizedVolFromCloses(closes);
  if (v === null || !Number.isFinite(v) || v <= 0) return DEFAULT_VOL;
  return Math.min(1.25, Math.max(0.08, v));
}

function priceEuropean(
  S: number,
  K: number,
  T: number,
  sigma: number,
  r: number,
  side: "call" | "put"
): number {
  if (!(S > 0) || !(K > 0) || !(T > 0) || !(sigma > 0)) return 0;
  const sqrtT = Math.sqrt(T);
  const d1 =
    (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const disc = Math.exp(-r * T);
  if (side === "call") {
    return S * normCDF(d1) - K * disc * normCDF(d2);
  }
  return K * disc * normCDF(-d2) - S * normCDF(-d1);
}

export type OptionQuoteInput = {
  spot: number;
  strike: number;
  /** Calendar days to expiry */
  daysToExpiry: number;
  sigma: number;
  side: "call" | "put";
};

/** Premium per share of underlying (same units as spot). */
export function optionPremiumPerShare(input: OptionQuoteInput): number {
  const T = Math.max(input.daysToExpiry, 1) / DAYS_PER_YEAR;
  const r = RISK_FREE_ANNUAL;
  const raw = priceEuropean(input.spot, input.strike, T, input.sigma, r, input.side);
  if (!Number.isFinite(raw) || raw < 0) return 0;
  const px = raw * SIMULATOR_PREMIUM_SCALE;
  return px;
}

function bsD2(S: number, K: number, T: number, sigma: number, r: number): number {
  if (!(S > 0) || !(K > 0) || !(T > 0) || !(sigma > 0)) return 0;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  return d1 - sigma * sqrtT;
}

/** Risk-neutral probability of expiring ITM (standard BS; educational). */
export function approxExpiryItmRiskNeutral(input: OptionQuoteInput): number {
  const T = Math.max(input.daysToExpiry, 1) / DAYS_PER_YEAR;
  const d2 = bsD2(input.spot, input.strike, T, input.sigma, RISK_FREE_ANNUAL);
  const p = input.side === "call" ? normCDF(d2) : normCDF(-d2);
  if (!Number.isFinite(p)) return 0;
  return Math.min(1, Math.max(0, p));
}

export function contractRsFromPerShare(perShare: number, quantity = 1): number {
  return Number((perShare * OPTION_CONTRACT_MULTIPLIER * quantity).toFixed(2));
}

/** @deprecated Use contractRsFromPerShare — kept for any legacy imports */
export function practiceContractPremiumRs(perSharePremium: number): number {
  return contractRsFromPerShare(perSharePremium, 1);
}

export function intrinsicPerShare(spot: number, strike: number, side: "call" | "put"): number {
  if (!Number.isFinite(spot) || !Number.isFinite(strike) || strike <= 0) return 0;
  return side === "call" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
}

/** Whole calendar days from today (UTC) to expiry date (YYYY-MM-DD). */
export function calendarDaysUntilExpiry(expiryIsoDate: string): number {
  const parts = expiryIsoDate.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return 0;
  const [y, m, d] = parts;
  const endUtc = Date.UTC(y, m - 1, d);
  const now = new Date();
  const startUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diff = Math.round((endUtc - startUtc) / 86400000);
  return Math.max(0, diff);
}

export type OptionTicketEconomics = {
  premiumPerShare: number;
  /** Total debit for the order (per-share premium × multiplier × qty). */
  totalDebitRs: number;
  intrinsicPerShare: number;
  intrinsicRs: number;
  timeValuePerShare: number;
  timeValueRs: number;
  /** Underlying level at which a long option breaks even at expiry (approx.). */
  breakEvenUnderlying: number;
  /** Long option: max loss = premium paid. */
  maxLossDebitRs: number;
};

/**
 * Single source of truth for ticket display: BS premium, intrinsic/time split, break-even.
 * Time value is floored at 0 so ITM deep contracts never show negative time value from numerics.
 */
export function computeOptionTicketEconomics(params: {
  spot: number;
  strike: number;
  side: "call" | "put";
  daysToExpiry: number;
  sigma: number;
  quantity: number;
}): OptionTicketEconomics | null {
  const { spot, strike, side, daysToExpiry, sigma, quantity } = params;
  if (!(spot > 0) || !(strike > 0) || !Number.isFinite(quantity) || quantity <= 0) return null;

  const premiumPerShare = optionPremiumPerShare({
    spot,
    strike,
    daysToExpiry,
    sigma,
    side,
  });

  const intPer = intrinsicPerShare(spot, strike, side);
  const timePerShare = Math.max(0, premiumPerShare - intPer);

  const breakEvenUnderlying =
    side === "call" ? strike + premiumPerShare : strike - premiumPerShare;

  const totalDebitRs = contractRsFromPerShare(premiumPerShare, quantity);
  const intrinsicRs = contractRsFromPerShare(intPer, quantity);
  const timeValueRs = contractRsFromPerShare(timePerShare, quantity);

  return {
    premiumPerShare,
    totalDebitRs,
    intrinsicPerShare: intPer,
    intrinsicRs,
    timeValuePerShare: timePerShare,
    timeValueRs,
    breakEvenUnderlying,
    maxLossDebitRs: totalDebitRs,
  };
}

/** Mark-to-model for an open position (same BS engine; use days remaining). */
export function estimateContractModelValueRs(params: {
  spot: number;
  strike: number;
  side: "call" | "put";
  daysToExpiry: number;
  sigma: number;
  quantity?: number;
}): number {
  const qty = params.quantity ?? 1;
  if (params.daysToExpiry <= 0) {
    const intPer = intrinsicPerShare(params.spot, params.strike, params.side);
    return contractRsFromPerShare(intPer, qty);
  }
  const per = optionPremiumPerShare({
    spot: params.spot,
    strike: params.strike,
    daysToExpiry: Math.max(1, params.daysToExpiry),
    sigma: params.sigma,
    side: params.side,
  });
  return contractRsFromPerShare(per, qty);
}

/** @deprecated Prefer estimateContractModelValueRs or intrinsic — was intrinsic-only, misleading vs premium */
export function illustrativePayoutRs(params: {
  spot: number;
  strike: number;
  side: "call" | "put";
}): number {
  const intPer = intrinsicPerShare(params.spot, params.strike, params.side);
  return contractRsFromPerShare(intPer, 1);
}

export function pickStrikeStep(spot: number): number {
  if (!Number.isFinite(spot) || spot <= 0) return 1;
  if (spot >= 500) return 50;
  if (spot >= 200) return 10;
  if (spot >= 50) return 5;
  if (spot >= 10) return 1;
  return 0.5;
}

/** Finer grid than `pickStrikeStep` so strikes hug spot more closely. */
export function tightStrikeStep(spot: number): number {
  const base = pickStrikeStep(spot);
  return Math.max(0.25, base / 2);
}

/**
 * Five strikes centered on spot with tight spacing (ATM ± 2 steps).
 * Avoids wide OTM-only ladders on typical PSX names.
 */
export function strikesAroundSpot(spot: number): number[] {
  if (!Number.isFinite(spot) || spot <= 0) return [];
  const step = tightStrikeStep(spot);
  const center = Math.round(spot / step) * step;
  const raw = [-2, -1, 0, 1, 2].map((i) => center + i * step);
  const seen = new Set<number>();
  const out: number[] = [];
  for (const k of raw) {
    if (k > 0 && !seen.has(k)) {
      seen.add(k);
      out.push(Number(k.toFixed(4)));
    }
  }
  return out.sort((a, b) => a - b);
}
