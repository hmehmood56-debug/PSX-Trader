import Link from "next/link";
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
        background: `linear-gradient(180deg, #FAFAF8 0%, ${palette.bg} 38%, ${palette.bg} 100%)`,
      }}
    >
      <PageEventTracker eventName="landing_view" metadata={{ route: "/" }} />
      <div className="perch-shell">
        <section className="home-hero">
          <div className="home-hero-copy">
            <div className="home-brand-lockup">
              <span>PERCH CAPITAL</span>
            </div>
            <h1 className="home-hero-headline" style={{ color: palette.text }}>
              Trading made simple.
            </h1>
            <p className="home-hero-subline">Real markets. Zero risk.</p>
            <p className="home-hero-trust">Built for the Pakistan Stock Exchange.</p>
            <div className="landing-cta-row home-start-ctas home-hero-ctas">
              <Link href="/start" className="home-cta-primary">
                Start Here
              </Link>
              <Link href="/markets" className="home-cta-secondary">
                Explore Markets
              </Link>
            </div>
            <aside className="home-waitlist-block" aria-label="Real trading waitlist">
              <div className="home-waitlist-block-inner">
                <p className="home-waitlist-eyebrow">LIVE TRADING</p>
                <p className="home-waitlist-title">Live trading is coming</p>
                <p className="home-waitlist-body">Get early access when we launch.</p>
                <p className="home-waitlist-trust">No spam. Early access only.</p>
                <Link href="/waitlist" className="home-waitlist-cta">
                  Join the waitlist
                </Link>
              </div>
            </aside>
            <p className="home-start-lead home-hero-returning" style={{ maxWidth: 420, fontSize: 15 }}>
              Returning user?{" "}
              <Link href="/signin" className="home-signin-link">
                Sign in
              </Link>
            </p>
          </div>
          <div className="home-product-preview" aria-label="Product preview">
            <div className="home-product-preview-glow" aria-hidden />
            <div className="home-product-preview-frame">
              <div className="home-product-preview-chrome">
                <span className="home-product-preview-dots" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
                <span className="home-product-preview-chrome-label">Paper workspace</span>
              </div>
              <div className="home-product-preview-body">
                <div className="home-market-head home-product-preview-head">
                  <span>Live PSX feed</span>
                  <strong>Portfolio overview</strong>
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
                <p className="home-product-preview-caption">
                  Practice with live quotes and portfolio tools—without putting capital at risk.
                </p>
              </div>
            </div>
          </div>
        </section>
        <footer className="home-landing-footer">
          <p>© 2026 Perch Capital. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
