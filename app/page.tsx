import Link from "next/link";

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
      <div className="perch-shell">
        <section className="home-start">
          <h1 style={{ color: palette.text }}>Start your first PSX investment</h1>
          <p className="home-start-lead">Practice with virtual funds before going live.</p>
          <div className="landing-cta-row landing-cta-row-centered home-start-ctas">
            <Link
              href="/start"
              style={{
                textDecoration: "none",
                background: palette.orange,
                color: "#FFFFFF",
                fontWeight: 600,
                borderRadius: 10,
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
                borderRadius: 10,
                background: "#FFFFFF",
              }}
            >
              Explore Markets
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
