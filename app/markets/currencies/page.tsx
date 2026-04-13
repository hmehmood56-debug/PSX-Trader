import Link from "next/link";

const palette = {
  orange: "#C45000",
  bg: "#FFFFFF",
  border: "#ECE8E4",
  text: "#171717",
  muted: "#646464",
} as const;

export default function CurrenciesPage() {
  return (
    <div style={{ background: palette.bg }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "36px 32px 72px" }}>
        <section
          style={{
            border: `1px solid ${palette.border}`,
            borderRadius: 20,
            background: "#FFFFFF",
            padding: "30px 28px",
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
            Currencies
          </p>
          <h1 style={{ margin: "10px 0 0", color: palette.text, fontSize: 40, lineHeight: 1.12 }}>
            Live FX tracking is coming soon
          </h1>
          <p style={{ marginTop: 12, color: palette.muted, fontSize: 16, lineHeight: "28px", maxWidth: 760 }}>
            This module is being prepared for real-time currency monitoring across major pairs. We are
            shipping it separately to keep the Markets platform clean and intentional.
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
            Planned coverage includes USD/PKR, EUR/USD, GBP/USD, and other major FX pairs.
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
