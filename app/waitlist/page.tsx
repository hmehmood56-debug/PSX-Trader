import type { Metadata } from "next";
import { PageEventTracker } from "@/components/analytics/PageEventTracker";
import { RealTradingWaitlist } from "@/components/waitlist/RealTradingWaitlist";

export const metadata: Metadata = {
  title: "Real trading interest | Perch",
  description:
    "Register your interest in live brokerage access for PSX, US stocks, crypto, and forex when Perch launches real trading.",
};

export default function RealTradingWaitlistPage() {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #faf8f5 0%, #ffffff 28%, #ffffff 100%)",
      }}
    >
      <PageEventTracker eventName="real_trading_waitlist_viewed" metadata={{ route: "/waitlist" }} />
      <div
        className="perch-shell"
        style={{
          paddingTop: "clamp(28px, 6vw, 52px)",
          paddingBottom: "clamp(52px, 10vw, 88px)",
        }}
      >
        <RealTradingWaitlist />
      </div>
    </div>
  );
}
