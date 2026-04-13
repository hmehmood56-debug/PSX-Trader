import Link from "next/link";

const palette = {
  orange: "#C45000",
  bg: "#FFFFFF",
  border: "#ECE8E4",
  text: "#171717",
  muted: "#646464",
  cardShadow: "0 14px 36px rgba(23, 23, 23, 0.06)",
} as const;

function MarketsCard({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <article
      style={{
        border: `1px solid ${palette.border}`,
        borderRadius: 18,
        background: "#FFFFFF",
        padding: 28,
        boxShadow: palette.cardShadow,
      }}
    >
      <h2 style={{ margin: 0, color: palette.text, fontSize: 28, fontWeight: 700 }}>{title}</h2>
      <p style={{ marginTop: 12, color: palette.muted, fontSize: 16, lineHeight: "28px", maxWidth: 560 }}>
        {description}
      </p>
      <Link
        href={href}
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
        {cta}
      </Link>
    </article>
  );
}

export default function MarketsHubPage() {
  const sections = [
    {
      title: "Simulated PSX",
      description:
        "Practice trading Pakistan equities with virtual funds. Build conviction, test decisions, and refine your process in Perch's paper-trading environment.",
      href: "/markets/psx",
      cta: "Open Simulated PSX",
    },
    {
      title: "Live Crypto",
      description:
        "Track BTC, ETH, and SOL with live pricing, 24h change, and market cap updates through a dedicated crypto market module.",
      href: "/markets/crypto",
      cta: "Open Live Crypto",
    },
    {
      title: "Currencies",
      description:
        "A focused FX market section for major currency pairs is coming soon, designed as a dedicated module instead of a mixed dashboard.",
      href: "/markets/currencies",
      cta: "View Currencies",
    },
    {
      title: "Global Indices",
      description:
        "A premium watchlist for major global indices is planned next, with dedicated coverage for key benchmark markets.",
      href: "/markets/indices",
      cta: "View Indices",
    },
  ];

  return (
    <div style={{ background: palette.bg }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "36px 32px 72px" }}>
        <section
          style={{
            border: `1px solid ${palette.border}`,
            borderRadius: 22,
            background: "linear-gradient(130deg, #FFF8F2 0%, #FFFFFF 100%)",
            padding: "34px 30px",
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
            Perch Capital Markets
          </p>
          <h1 style={{ margin: "10px 0 0", color: palette.text, fontSize: 44, lineHeight: 1.12, maxWidth: 760 }}>
            Choose your market module
          </h1>
          <p style={{ marginTop: 14, color: palette.muted, fontSize: 17, lineHeight: "30px", maxWidth: 760 }}>
            Perch Markets is organized into dedicated sections so each experience is either fully live
            or intentionally staged for rollout.
          </p>
        </section>

        <section style={{ marginTop: 22, display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {sections.map((section) => (
            <MarketsCard
              key={section.title}
              title={section.title}
              description={section.description}
              href={section.href}
              cta={section.cta}
            />
          ))}
        </section>
      </div>
    </div>
  );
}
