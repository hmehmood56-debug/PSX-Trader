import Link from "next/link";
import { PageEventTracker } from "@/components/analytics/PageEventTracker";
import { LiveMarketSurface, type LiveSectorCell } from "@/components/home/LiveMarketSurface";

type SectorStock = {
  symbol: string;
  changePct: number;
};

const groupedSectorMoves: Array<{ sector: string; stocks: SectorStock[] }> = [
  {
    sector: "Energy",
    stocks: [
      { symbol: "PSO", changePct: 1.1 },
      { symbol: "OGDC", changePct: 0.8 },
      { symbol: "PPL", changePct: -0.2 },
    ],
  },
  {
    sector: "Banks",
    stocks: [
      { symbol: "MCB", changePct: 0.6 },
      { symbol: "HBL", changePct: 0.3 },
      { symbol: "UBL", changePct: -0.1 },
    ],
  },
  {
    sector: "Fertilizer",
    stocks: [
      { symbol: "ENGRO", changePct: 1.4 },
      { symbol: "FFC", changePct: 0.7 },
      { symbol: "EFERT", changePct: 0.5 },
    ],
  },
  {
    sector: "Cement",
    stocks: [
      { symbol: "LUCK", changePct: 0.2 },
      { symbol: "DGKC", changePct: -0.5 },
      { symbol: "MLCF", changePct: -0.1 },
    ],
  },
  {
    sector: "Tech",
    stocks: [
      { symbol: "SYS", changePct: 1.3 },
      { symbol: "TRG", changePct: 0.4 },
      { symbol: "NETSOL", changePct: 0.2 },
    ],
  },
  {
    sector: "Consumer",
    stocks: [
      { symbol: "MARI", changePct: 0.4 },
      { symbol: "NESTLE", changePct: -0.2 },
      { symbol: "UNITY", changePct: 0.3 },
    ],
  },
];

const initialHeatmapPreview: LiveSectorCell[] = groupedSectorMoves.map((group) => {
  const avg = group.stocks.reduce((sum, stock) => sum + stock.changePct, 0) / group.stocks.length;
  return {
    sector: group.sector,
    move: Math.round(avg * 10) / 10,
  };
});

export default function LandingPage() {
  return (
    <div
      className="home-landing-canvas"
      style={{
        background: `linear-gradient(135deg, #fffdf9 0%, #f6f1ea 52%, #f3eee7 100%)`,
      }}
    >
      <PageEventTracker eventName="landing_view" metadata={{ route: "/" }} />
      <div className="perch-shell home-landing-shell">
        <section className="home-hero">
          <div className="home-hero-copy">
            <div className="home-brand-lockup">
              <span>PERCH CAPITAL</span>
            </div>
            <h1 className="home-hero-headline">
              Trading made <span>simple</span>.
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
            <div className="home-inline-waitlist" aria-label="Real trading waitlist">
              <p className="home-inline-waitlist-label">Early access to real markets.</p>
              <p className="home-inline-waitlist-subcopy">
                Be first to trade live on Perch when brokerage launches. Get priority access as we roll out in phases.
              </p>
              <ul className="home-inline-waitlist-benefits" aria-label="Early access benefits">
                <li>Trade with real capital (when live)</li>
                <li>Priority rollout access</li>
                <li>Early feature access</li>
              </ul>
              <Link href="/waitlist" className="home-inline-waitlist-cta">
                Get early access →
              </Link>
              <p className="home-inline-waitlist-scarcity">Rolling out in phases</p>
            </div>
            <p className="home-start-lead home-hero-returning" style={{ maxWidth: 420, fontSize: 15 }}>
              Returning user?{" "}
              <Link href="/signin" className="home-signin-link">
                Sign in
              </Link>
            </p>
          </div>
          <div className="home-product-preview" aria-label="Market heatmap preview">
            <div className="home-product-preview-glow" aria-hidden />
            <LiveMarketSurface initialCells={initialHeatmapPreview} />
          </div>
        </section>
        <footer className="home-landing-footer">
          <nav
            aria-label="Legal"
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "center",
              gap: "6px 14px",
              marginBottom: 10,
            }}
          >
            <Link href="/privacy" className="home-signin-link">
              Privacy Policy
            </Link>
            <span style={{ color: "#d6d3cd", fontSize: 12, userSelect: "none" }} aria-hidden>
              ·
            </span>
            <Link href="/terms" className="home-signin-link">
              Terms of Service
            </Link>
          </nav>
          <p>© 2026 Perch Capital. All rights reserved.</p>
          <p>
            Contact:{" "}
            <a href="mailto:hello@joinperch.me" style={{ color: "inherit", textDecoration: "none" }}>
              hello@joinperch.me
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
