import Link from "next/link";

const palette = {
  orange: "#C45000",
  bg: "#FFFFFF",
  border: "#ECE8E4",
  text: "#171717",
  muted: "#646464",
} as const;

export default function IndicesPage() {
  return (
    <div style={{ background: palette.bg }}>
      <div
        className="perch-shell"
        style={{ paddingTop: "clamp(24px, 5vw, 36px)", paddingBottom: "clamp(48px, 10vw, 72px)" }}
      >
        <section
          style={{
            border: `1px solid ${palette.border}`,
            borderRadius: 20,
            background: "#FFFFFF",
            padding: "clamp(20px, 4vw, 30px) clamp(18px, 4vw, 28px)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: palette.orange,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Global Indices
          </p>
          <h1
            style={{
              margin: "10px 0 0",
              color: palette.text,
              fontSize: "clamp(26px, 6vw, 40px)",
              lineHeight: 1.12,
            }}
          >
            Global index tracking is coming soon
          </h1>
          <p style={{ marginTop: 12, color: palette.muted, fontSize: 16, lineHeight: "28px", maxWidth: 760 }}>
            This section will provide a focused watchlist for major index benchmarks once the live feed
            layer is integrated.
          </p>
          <div
            style={{
              marginTop: 18,
              border: `1px solid ${palette.border}`,
              borderRadius: 12,
              padding: "12px 14px",
              fontSize: 13,
              color: palette.muted,
              background: "#FAF9F7",
              maxWidth: 620,
            }}
          >
            Planned coverage includes S&P 500, Nasdaq, Dow, FTSE, DAX, and Nikkei.
          </div>
          <Link
            href="/markets"
            style={{
              marginTop: 20,
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
              borderRadius: 10,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 650,
              color: "#FFFFFF",
              background: palette.orange,
            }}
          >
            Back to Markets
          </Link>
        </section>
      </div>
    </div>
  );
}
