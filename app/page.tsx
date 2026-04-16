import Link from "next/link";
import { PerchWordmark } from "@/components/PerchWordmark";
import { PageEventTracker } from "@/components/analytics/PageEventTracker";

const palette = {
  orange: "#C45000",
  bg: "#FFFFFF",
  border: "#ECE8E4",
  text: "#171717",
} as const;

export default function LandingPage() {
  return (
    <div
      style={{
        background: `linear-gradient(180deg, #FAFAF8 0%, ${palette.bg} 42%, ${palette.bg} 100%)`,
      }}
    >
      <PageEventTracker eventName="landing_view" metadata={{ route: "/" }} />
      <div className="perch-shell">
        <section className="home-hero">
          <div className="home-hero-copy">
            <div className="home-brand-lockup">
              <PerchWordmark />
              <span>Live PSX Paper Trading</span>
            </div>
            <h1 style={{ color: palette.text }}>Build confidence before you invest live</h1>
            <p className="home-start-lead">
              Practice PSX investing in a clean, brokerage-style workspace with realistic market data,
              disciplined portfolio tools, and a beginner-friendly first-trade flow.
            </p>
            <div className="landing-cta-row home-start-ctas">
              <Link
                href="/start"
                style={{
                  textDecoration: "none",
                  background: palette.orange,
                  color: "#FFFFFF",
                  fontWeight: 600,
                  borderRadius: 8,
                  boxShadow: "0 12px 28px rgba(196, 80, 0, 0.22)",
                }}
              >
                Start Here
              </Link>
              <Link
                href="/markets"
                style={{
                  textDecoration: "none",
                  border: `1px solid ${palette.border}`,
                  color: palette.text,
                  fontWeight: 600,
                  borderRadius: 8,
                  background: "#FFFFFF",
                }}
              >
                Explore Markets
              </Link>
            </div>
            <p className="home-start-lead" style={{ marginTop: 16, maxWidth: 420, fontSize: 15 }}>
              Returning user?{" "}
              <Link href="/signin" style={{ color: palette.orange, fontWeight: 600 }}>
                Sign in
              </Link>
            </p>
          </div>
          <div className="home-market-panel" aria-label="Market snapshot panel">
            <div className="home-market-head">
              <span>Pakistan Stock Exchange (Live Feed)</span>
              <strong>Market Snapshot</strong>
            </div>
            <div className="home-market-strip">
              <div>
                <span>KSE-100</span>
                <strong>76,421.33</strong>
              </div>
              <div>
                <span>Advance / Decline</span>
                <strong>214 / 128</strong>
              </div>
              <div>
                <span>Turnover</span>
                <strong>PKR 8.4B</strong>
              </div>
            </div>
            <div className="home-market-sparkline" aria-hidden>
              <span />
            </div>
            <p>
              Live market snapshot with paper trading tools for disciplined practice.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
