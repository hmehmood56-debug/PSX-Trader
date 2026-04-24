export type AnalyticsEventName =
  | "landing_view"
  | "onboarding_started"
  | "onboarding_completed"
  | "first_trade_completed"
  | "signup_completed"
  | "login_completed"
  | "google_auth_started"
  | "session_started"
  | "return_visit"
  | "dashboard_viewed"
  | "stock_detail_viewed"
  | "crypto_detail_viewed"
  | "portfolio_viewed"
  | "trade_ticket_opened"
  | "trade_executed"
  | "deposit_virtual_funds"
  | "withdraw_virtual_funds"
  | "options_viewed"
  | "option_trade_executed"
  | "real_trading_waitlist_viewed"
  | "real_trading_waitlist_joined";

export type AnalyticsMetadata = Record<string, unknown>;
