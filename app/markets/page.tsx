import Link from "next/link";
import { canAccessStagedMarketModule } from "@/lib/featureAccess";

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
        padding: "clamp(20px, 4vw, 28px)",
        boxShadow: palette.cardShadow,
      }}
    >
      <h2
        style={{
          margin: 0,
          color: palette.text,
          fontSize: "clamp(20px, 4.5vw, 28px)",
          fontWeight: 700,
          lineHeight: 1.2,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          marginTop: 12,
          color: palette.muted,
          fontSize: 15,
          lineHeight: 1.65,
          maxWidth: 560,
        }}
      >
        {description}
      </p>
      <Link
        href={href}
        style={{
          marginTop: 20,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
          borderRadius: 10,
          minHeight: 48,
          padding: "12px 18px",
          fontSize: 15,
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

export default async function MarketsHubPage() {
  const [canSeeCurrencies, canSeeIndices] = await Promise.all([
    canAccessStagedMarketModule("currencies"),
    canAccessStagedMarketModule("indices"),
  ]);

  const sections = [
    {
      title: "PSX Paper Trading",
      description:
        "Practice trading Pakistan equities with live PSX market data, virtual funds, and full portfolio tracking in Perch.",
      href: "/markets/psx",
      cta: "Open PSX Paper Trading",
    },
    {
      title: "Live Crypto",
      description:
        "Track BTC, ETH, and SOL with live pricing, 24h change, and market cap updates through a dedicated crypto market module.",
      href: "/markets/crypto",
      cta: "Open Live Crypto",
    },
  ];
  if (canSeeCurrencies) {
    sections.push({
      title: "Currencies",
      description:
        "A focused FX market section for major currency pairs is coming soon, designed as a dedicated module instead of a mixed dashboard.",
      href: "/markets/currencies",
      cta: "View Currencies",
    });
  }
  if (canSeeIndices) {
    sections.push({
      title: "Global Indices",
      description:
        "A premium watchlist for major global indices is planned next, with dedicated coverage for key benchmark markets.",
      href: "/markets/indices",
      cta: "View Indices",
    });
  }

  return (
    <div style={{ background: palette.bg }}>
      <div
        className="perch-shell markets-hero"
        style={{ paddingTop: "clamp(24px, 5vw, 36px)", paddingBottom: "clamp(48px, 10vw, 72px)" }}
      >
        <section
          style={{
            border: `1px solid ${palette.border}`,
            borderRadius: 22,
            background: "linear-gradient(130deg, #FFF8F2 0%, #FFFFFF 100%)",
            padding: "clamp(22px, 4vw, 34px) clamp(18px, 4vw, 30px)",
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
          <h1 style={{ margin: "10px 0 0", color: palette.text, lineHeight: 1.12, maxWidth: 760 }}>
            Choose your market module
          </h1>
          <p
            style={{
              marginTop: 14,
              color: palette.muted,
              fontSize: 16,
              lineHeight: 1.65,
              maxWidth: 760,
            }}
          >
            Perch Markets is organized into dedicated sections so each experience is either fully live or
            intentionally staged for rollout.
          </p>
        </section>

        <section className="markets-hub-grid" style={{ marginTop: 22 }}>
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
