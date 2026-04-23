import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bitcoin,
  ChartCandlestick,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import { canAccessStagedMarketModule } from "@/lib/featureAccess";
import { StockLogo } from "@/components/common/StockLogo";

const palette = {
  orange: "#B9682B",
  bg: "#F8F4EF",
  border: "rgba(23, 23, 23, 0.08)",
  text: "#171717",
  muted: "#646464",
  cardShadow: "0 10px 28px rgba(23, 23, 23, 0.045)",
} as const;

function IconBadge({
  tone,
  children,
}: {
  tone: "orange" | "purple" | "blue" | "neutral";
  children: ReactNode;
}) {
  const tones = {
    orange: { bg: "rgba(185, 104, 43, 0.12)", color: "#A45723" },
    purple: { bg: "rgba(127, 91, 158, 0.14)", color: "#6F4C8F" },
    blue: { bg: "rgba(89, 124, 156, 0.14)", color: "#4D6F90" },
    neutral: { bg: "rgba(80, 72, 64, 0.1)", color: "#5E5751" },
  } as const;

  const selected = tones[tone];

  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 10,
        background: selected.bg,
        color: selected.color,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

function SecondaryModuleCard({
  title,
  description,
  href,
  cta,
  tone,
  icon,
  background,
  lineAccent,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
  tone: "purple" | "blue" | "neutral";
  icon: ReactNode;
  background: string;
  lineAccent: string;
}) {
  return (
    <article
      style={{
        border: "1px solid rgba(23, 23, 23, 0.06)",
        borderRadius: 16,
        background,
        padding: "14px",
        boxShadow: palette.cardShadow,
        display: "flex",
        flexDirection: "column",
        gap: 9,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <IconBadge tone={tone}>{icon}</IconBadge>
          <h2
            style={{
              margin: 0,
              color: palette.text,
              fontSize: 20,
              fontWeight: 700,
              lineHeight: 1.2,
            }}
          >
            {title}
          </h2>
        </div>
        <Link
          href={href}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            textDecoration: "none",
            borderRadius: 9,
            minHeight: 38,
            padding: "8px 12px",
            fontSize: 13,
            fontWeight: 650,
            color: palette.text,
            background: "rgba(255,255,255,0.62)",
            border: "1px solid rgba(23, 23, 23, 0.06)",
            flexShrink: 0,
          }}
        >
          {cta}
          <ArrowRight size={14} strokeWidth={2} />
        </Link>
      </div>
      <p
        style={{
          margin: 0,
          color: palette.muted,
          fontSize: 14,
          lineHeight: 1.55,
        }}
      >
        {description}
      </p>
      <div
        aria-hidden
        style={{
          marginTop: 0,
          height: 1.5,
          borderRadius: 999,
          background: lineAccent,
          opacity: 0.55,
        }}
      />
    </article>
  );
}

export default async function MarketsHubPage() {
  const [canSeeCurrencies, canSeeIndices] = await Promise.all([
    canAccessStagedMarketModule("currencies"),
    canAccessStagedMarketModule("indices"),
  ]);

  const stagedModules: Array<{ title: string; description: string; href: string; cta: string }> = [];
  if (canSeeCurrencies) {
    stagedModules.push({
      title: "Currencies",
      description:
        "A focused FX market section for major currency pairs is coming soon, designed as a dedicated module instead of a mixed dashboard.",
      href: "/markets/currencies",
      cta: "View Currencies",
    });
  }
  if (canSeeIndices) {
    stagedModules.push({
      title: "Global Indices",
      description:
        "A premium watchlist for major global indices is planned next, with dedicated coverage for key benchmark markets.",
      href: "/markets/indices",
      cta: "View Indices",
    });
  }

  const secondaryModules = [
    {
      title: "Simulated PSX Options",
      description: "Practice options strategies with PSX-linked pricing in a simulation-first environment.",
      href: "/markets/options",
      cta: "Open Options Simulator",
      tone: "purple" as const,
      icon: <ChartCandlestick size={18} strokeWidth={2} />,
      background: "linear-gradient(180deg, rgba(127, 91, 158, 0.08) 0%, rgba(255,255,255,0.85) 100%)",
      lineAccent: "linear-gradient(90deg, rgba(111, 76, 143, 0.55), rgba(111, 76, 143, 0.15))",
    },
    {
      title: "Live Crypto",
      description:
        "Follow major crypto markets in a dedicated live module while keeping your PSX practice flow separate.",
      href: "/markets/crypto",
      cta: "Open Live Crypto",
      tone: "blue" as const,
      icon: <Bitcoin size={18} strokeWidth={2} />,
      background: "linear-gradient(180deg, rgba(89, 124, 156, 0.09) 0%, rgba(255,255,255,0.86) 100%)",
      lineAccent: "linear-gradient(90deg, rgba(77, 111, 144, 0.56), rgba(77, 111, 144, 0.14))",
    },
  ];

  return (
    <div style={{ background: palette.bg }}>
      <div className="perch-shell" style={{ paddingTop: "clamp(12px, 2.5vw, 18px)", paddingBottom: "clamp(16px, 3vw, 24px)" }}>
        <section
          style={{
            padding: "0 2px",
          }}
        >
          <h1
            style={{
              margin: 0,
              color: "#2A2622",
              lineHeight: 1.14,
              fontSize: "clamp(30px, 6vw, 42px)",
              fontWeight: 650,
              letterSpacing: "-0.015em",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 3,
                height: "0.95em",
                borderRadius: 999,
                background: "rgba(185, 104, 43, 0.7)",
              }}
            />
            Perch Markets
          </h1>
          <p
            style={{
              marginTop: 8,
              color: palette.muted,
              fontSize: 15,
              lineHeight: 1.5,
              maxWidth: 720,
            }}
          >
            Pick the market module you want to train and track in. Each experience is purpose-built so your workflow
            stays focused.
          </p>
        </section>

        <section style={{ marginTop: 6 }}>
          <article
            style={{
              border: "1px solid rgba(185, 104, 43, 0.12)",
              borderRadius: 22,
              background: "linear-gradient(145deg, rgba(185, 104, 43, 0.1) 0%, rgba(255,255,255,0.78) 100%)",
              boxShadow: palette.cardShadow,
              padding: "clamp(14px, 2.6vw, 18px)",
              display: "grid",
              gap: 8,
              gridTemplateColumns: "minmax(0, 1fr)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  maxWidth: 64,
                  maxHeight: 64,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <StockLogo ticker="PSX" size={40} />
              </span>
              <h2
                style={{
                  margin: 0,
                  color: "#2A2622",
                  fontSize: "clamp(28px, 5vw, 36px)",
                  lineHeight: 1.1,
                  fontWeight: 650,
                  letterSpacing: "-0.012em",
                }}
              >
                PSX Paper Trading
              </h2>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: "4px 0 0", color: palette.muted, fontSize: 15, lineHeight: 1.52, maxWidth: 700 }}>
                Practice Pakistan equities in an execution-focused environment with real market context and simulation
                safety.
              </p>
              <div style={{ marginTop: 9, display: "grid", gap: 6 }}>
                {[
                  "Real market experience in a practice-first setup",
                  "Virtual funds and portfolio tracking built for repeat learning",
                  "Performance and decision analytics to improve consistency",
                ].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <IconBadge tone="orange">
                      <ShieldCheck size={16} strokeWidth={2} />
                    </IconBadge>
                    <span style={{ color: palette.text, fontSize: 14, fontWeight: 550 }}>{item}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/markets/psx"
                style={{
                  marginTop: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  textDecoration: "none",
                  borderRadius: 10,
                  minHeight: 42,
                  padding: "9px 14px",
                  fontSize: 14,
                  fontWeight: 650,
                  color: "#FFFFFF",
                  background: palette.orange,
                  boxShadow: "0 8px 18px rgba(185, 104, 43, 0.2)",
                }}
              >
                Open PSX Paper Trading
                <ArrowRight size={16} strokeWidth={2} />
              </Link>
            </div>
          </article>
        </section>

        <section style={{ marginTop: 8, display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {secondaryModules.map((module) => (
            <SecondaryModuleCard
              key={module.title}
              title={module.title}
              description={module.description}
              href={module.href}
              cta={module.cta}
              tone={module.tone}
              icon={module.icon}
              background={module.background}
              lineAccent={module.lineAccent}
            />
          ))}
          {stagedModules.map((module) => (
            <SecondaryModuleCard
              key={module.title}
              title={module.title}
              description={module.description}
              href={module.href}
              cta={module.cta}
              tone="neutral"
              icon={<Clock3 size={18} strokeWidth={2} />}
              background="linear-gradient(180deg, rgba(80, 72, 64, 0.06) 0%, rgba(255,255,255,0.82) 100%)"
              lineAccent="linear-gradient(90deg, rgba(94, 87, 81, 0.45), rgba(94, 87, 81, 0.12))"
            />
          ))}
        </section>

        <section style={{ marginTop: 7 }}>
          <article
            style={{
              border: "1px solid rgba(185, 104, 43, 0.15)",
              borderRadius: 16,
              background: "linear-gradient(180deg, rgba(185, 104, 43, 0.12) 0%, rgba(255, 247, 240, 0.72) 100%)",
              padding: "9px clamp(10px, 2.1vw, 14px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <IconBadge tone="orange">
                <Clock3 size={16} strokeWidth={2} />
              </IconBadge>
              <p style={{ margin: 0, color: palette.text, fontSize: 14, lineHeight: 1.5 }}>
                Real trading access is on the roadmap. Join the waitlist to get notified as brokerage support rolls
                out.
              </p>
            </div>
            <Link
              href="/waitlist"
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                textDecoration: "none",
                borderRadius: 10,
                minHeight: 38,
                padding: "8px 13px",
                fontSize: 13,
                fontWeight: 650,
                color: "#FFFFFF",
                background: palette.orange,
                boxShadow: "0 8px 18px rgba(185, 104, 43, 0.2)",
              }}
            >
              Join waitlist
              <ArrowRight size={16} strokeWidth={2} />
            </Link>
          </article>
        </section>
      </div>
    </div>
  );
}
