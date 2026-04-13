import Link from "next/link";

const palette = {
  orange: "#C45000",
  orangeSoft: "#F7EBDD",
  bg: "#FFFFFF",
  bgSection: "#FAF9F7",
  border: "#ECE8E4",
  text: "#171717",
  muted: "#646464",
  shadow: "0 18px 50px rgba(23, 23, 23, 0.06)",
} as const;

const whyPerch = [
  {
    title: "Paper Trading",
    description: "Practice your strategy with virtual funds before you risk real capital.",
  },
  {
    title: "Real Brokerage Experience",
    description: "Trade flows, order logic, and portfolio behavior mirror a real investing desk.",
  },
  {
    title: "Zero Visible Fees",
    description: "Execute simulated PSX trades commission-free so your learning stays focused.",
  },
];

const howItWorks = [
  "Fund your virtual account",
  "Place paper trades",
  "Track your performance",
];

export default function LandingPage() {
  return (
    <div style={{ background: palette.bg }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "32px 32px 88px" }}>
        <section
          style={{
            padding: "72px 0 64px",
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 40,
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                color: palette.orange,
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Pakistan-first investing simulator
            </p>
            <h1
              style={{
                marginTop: 18,
                color: palette.text,
                fontSize: 56,
                lineHeight: 1.1,
                fontWeight: 700,
                maxWidth: 660,
              }}
            >
              Practice investing on PSX, commission-free
            </h1>
            <p
              style={{
                marginTop: 24,
                maxWidth: 620,
                color: palette.muted,
                fontSize: 18,
                lineHeight: 1.7,
              }}
            >
              Perch gives you virtual funds inside a real brokerage-style interface with
              live market movement, so you can build investing confidence before you go
              live.
            </p>
            <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 14 }}>
              <Link
                href="/dashboard"
                style={{
                  textDecoration: "none",
                  background: palette.orange,
                  color: "#FFFFFF",
                  fontWeight: 600,
                  fontSize: 15,
                  borderRadius: 10,
                  padding: "13px 22px",
                  boxShadow: "0 12px 28px rgba(196, 80, 0, 0.22)",
                }}
              >
                Start Investing
              </Link>
              <Link
                href="/stocks"
                style={{
                  textDecoration: "none",
                  border: `1px solid ${palette.border}`,
                  color: palette.text,
                  fontWeight: 600,
                  fontSize: 15,
                  borderRadius: 10,
                  padding: "13px 22px",
                  background: "#FFFFFF",
                }}
              >
                Explore Markets
              </Link>
            </div>
          </div>

          <div
            style={{
              border: `1px solid ${palette.border}`,
              borderRadius: 20,
              padding: 24,
              background: "#FFFFFF",
              boxShadow: palette.shadow,
            }}
          >
            <PreviewTile
              title="Market Movers"
              subtitle="PSX Snapshot"
              items={[
                { label: "MARI", value: "+2.21%" },
                { label: "OGDC", value: "+1.74%" },
                { label: "LUCK", value: "-0.48%" },
              ]}
            />
            <PreviewTile
              title="Account Funding"
              subtitle="Virtual Balance"
              items={[
                { label: "Funding Source", value: "Sim Wallet" },
                { label: "Available Cash", value: "₨ 1,000,000" },
                { label: "Settlement", value: "Instant" },
              ]}
            />
            <PreviewTile
              title="Portfolio Tracking"
              subtitle="Daily Performance"
              items={[
                { label: "Today", value: "+₨ 12,750" },
                { label: "Total Return", value: "+4.92%" },
                { label: "Risk View", value: "Balanced" },
              ]}
              isLast
            />
          </div>
        </section>

        <section
          style={{
            border: `1px solid ${palette.border}`,
            borderRadius: 18,
            padding: "24px 26px",
            background: palette.bgSection,
          }}
        >
          <p style={{ color: palette.orange, fontWeight: 600, fontSize: 13 }}>Perch Capital</p>
          <p style={{ marginTop: 8, color: palette.text, fontSize: 24, fontWeight: 600 }}>
            Pakistan-first simulator for disciplined PSX investing
          </p>
          <p style={{ marginTop: 10, color: palette.muted, fontSize: 16, lineHeight: 1.7 }}>
            Purpose-built for investors who want serious practice before they enter the live
            market.
          </p>
        </section>

        <section style={{ marginTop: 86 }}>
          <SectionTitle title="Why Perch" />
          <div
            style={{
              marginTop: 26,
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 18,
            }}
          >
            {whyPerch.map((item) => (
              <div
                key={item.title}
                style={{
                  border: `1px solid ${palette.border}`,
                  borderRadius: 16,
                  background: "#FFFFFF",
                  padding: 24,
                  boxShadow: "0 10px 30px rgba(23, 23, 23, 0.05)",
                }}
              >
                <h3 style={{ color: palette.text, fontSize: 20, fontWeight: 600 }}>
                  {item.title}
                </h3>
                <p
                  style={{
                    marginTop: 10,
                    color: palette.muted,
                    fontSize: 15,
                    lineHeight: 1.7,
                  }}
                >
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 86 }}>
          <SectionTitle title="Product Preview" />
          <div
            style={{
              marginTop: 26,
              border: `1px solid ${palette.border}`,
              borderRadius: 18,
              background: "#FFFFFF",
              overflow: "hidden",
              boxShadow: palette.shadow,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              }}
            >
              <PreviewPanel
                title="Market Movers"
                description="Watch gainers and decliners update in a clean PSX watchlist view."
              />
              <PreviewPanel
                title="Account Funding"
                description="Control virtual capital allocation and practice position sizing."
              />
              <PreviewPanel
                title="Portfolio Tracking"
                description="Review holdings, returns, and trade history with brokerage-style clarity."
                isLast
              />
            </div>
          </div>
        </section>

        <section style={{ marginTop: 86 }}>
          <SectionTitle title="How It Works" />
          <div
            style={{
              marginTop: 26,
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 18,
            }}
          >
            {howItWorks.map((step, idx) => (
              <div
                key={step}
                style={{
                  border: `1px solid ${palette.border}`,
                  borderRadius: 14,
                  padding: 22,
                  background: "#FFFFFF",
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: palette.orange,
                    textTransform: "uppercase",
                  }}
                >
                  Step {idx + 1}
                </p>
                <p style={{ marginTop: 10, fontSize: 20, fontWeight: 600, color: palette.text }}>
                  {step}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: 94,
            background: palette.orangeSoft,
            border: `1px solid #E7D5C8`,
            borderRadius: 18,
            padding: "42px 34px",
            textAlign: "center",
          }}
        >
          <h2 style={{ color: palette.text, fontSize: 36, lineHeight: 1.2, fontWeight: 700 }}>
            Build conviction before you trade live.
          </h2>
          <p style={{ marginTop: 16, color: palette.muted, fontSize: 17, lineHeight: 1.7 }}>
            Join Perch Capital and sharpen your investing decisions in a realistic PSX
            simulation environment.
          </p>
          <div style={{ marginTop: 26 }}>
            <Link
              href="/dashboard"
              style={{
                textDecoration: "none",
                display: "inline-block",
                background: palette.orange,
                color: "#FFFFFF",
                fontWeight: 600,
                fontSize: 15,
                borderRadius: 10,
                padding: "13px 24px",
                boxShadow: "0 12px 28px rgba(196, 80, 0, 0.2)",
              }}
            >
              Start Investing
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div>
      <p
        style={{
          color: palette.orange,
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 700,
        }}
      >
        Perch Capital
      </p>
      <h2 style={{ marginTop: 8, color: palette.text, fontSize: 36, fontWeight: 700 }}>
        {title}
      </h2>
    </div>
  );
}

function PreviewTile({
  title,
  subtitle,
  items,
  isLast,
}: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; value: string }>;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        paddingBottom: isLast ? 0 : 16,
        marginBottom: isLast ? 0 : 16,
        borderBottom: isLast ? "none" : `1px solid ${palette.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <p style={{ color: palette.text, fontSize: 16, fontWeight: 600 }}>{title}</p>
        <p style={{ color: palette.muted, fontSize: 12 }}>{subtitle}</p>
      </div>
      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        {items.map((item) => (
          <div
            key={item.label}
            style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
          >
            <span style={{ color: palette.muted, fontSize: 13 }}>{item.label}</span>
            <span style={{ color: palette.text, fontSize: 13, fontWeight: 600 }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewPanel({
  title,
  description,
  isLast,
}: {
  title: string;
  description: string;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        padding: 24,
        borderRight: isLast ? "none" : `1px solid ${palette.border}`,
      }}
    >
      <p style={{ color: palette.text, fontSize: 20, fontWeight: 600 }}>{title}</p>
      <p style={{ marginTop: 10, color: palette.muted, fontSize: 15, lineHeight: 1.7 }}>
        {description}
      </p>
    </div>
  );
}
