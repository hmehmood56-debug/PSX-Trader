"use client";

import Link from "next/link";
import { useState } from "react";

const COLORS = {
  orange: "#C45000",
  bg: "#FFFFFF",
  bgSecondary: "#F7F7F7",
  border: "#E8E8E8",
  text: "#1A1A1A",
  muted: "#6B6B6B",
} as const;

type Lesson = {
  id: string;
  title: string;
  summary: string;
  points: string[];
};

const LESSONS: Lesson[] = [
  {
    id: "psx",
    title: "What is PSX?",
    summary:
      "The Pakistan Stock Exchange (PSX) is the main marketplace where shares of listed companies are bought and sold in Pakistan.",
    points: [
      "Think of PSX as a marketplace for company ownership.",
      "When you buy a stock, you own a small piece of that company.",
      "Prices move based on company performance and investor demand.",
      "In this simulator, you can practice without risking real money.",
    ],
  },
  {
    id: "stocks",
    title: "How Stocks Work",
    summary:
      "Stock prices can rise or fall each day. Your return depends on the change in price and any income from dividends.",
    points: [
      "You profit when you sell at a higher price than your buy price.",
      "You take a loss when you sell below your buy price.",
      "Short-term moves can be noisy, so focus on risk and position size.",
      "Diversifying across sectors can reduce portfolio volatility.",
    ],
  },
  {
    id: "dividend",
    title: "What is a Dividend?",
    summary:
      "A dividend is a cash payment some companies share with stockholders, usually from profits.",
    points: [
      "Not every company pays dividends.",
      "Dividend-paying stocks may suit investors who want regular income.",
      "A high dividend is not always better; check business quality too.",
      "Total return combines price growth and dividend income.",
    ],
  },
  {
    id: "portfolio",
    title: "Building a Basic Portfolio",
    summary:
      "A basic portfolio spreads money across multiple companies instead of placing everything in one stock.",
    points: [
      "Start with a mix of sectors, not one single theme.",
      "Decide your risk level before you place trades.",
      "Review holdings regularly and rebalance when needed.",
      "Keep a cash buffer so you can handle market swings calmly.",
    ],
  },
];

function cardStyle(): React.CSSProperties {
  return {
    background: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
    padding: 20,
    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
  };
}

export default function LearnPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div style={{ background: COLORS.bg }}>
      <div className="perch-shell perch-shell-wide perch-psx-shell">
        <section>
          <span
            style={{
              display: "inline-block",
              fontSize: 11,
              color: COLORS.orange,
              fontWeight: 700,
              border: `1px solid rgba(196,80,0,0.28)`,
              borderRadius: 999,
              padding: "4px 8px",
              background: "rgba(196,80,0,0.06)",
              letterSpacing: "0.03em",
            }}
          >
            Pakistan Stock Exchange
          </span>
          <h1
            style={{
              margin: "10px 0 0",
              color: COLORS.text,
              fontSize: "clamp(26px, 6vw, 34px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            Investor Education
          </h1>
          <p
            style={{
              marginTop: 10,
              maxWidth: 760,
              color: COLORS.muted,
              fontSize: 15,
              lineHeight: "24px",
            }}
          >
            Build confidence with clear, practical guidance on investing concepts
            and the PSX Market before you place your next simulated order.
          </p>
        </section>

        <section className="perch-learn-grid">
          {LESSONS.map((lesson) => {
            const open = openId === lesson.id;
            return (
              <article key={lesson.id} style={cardStyle()}>
                <h2
                  style={{
                    color: COLORS.text,
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {lesson.title}
                </h2>
                <p
                  style={{
                    marginTop: 8,
                    color: COLORS.muted,
                    fontSize: 14,
                    lineHeight: "22px",
                  }}
                >
                  {lesson.summary}
                </p>

                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : lesson.id)}
                  style={{
                    marginTop: 12,
                    border: `1px solid ${COLORS.border}`,
                    background: open ? COLORS.bgSecondary : COLORS.bg,
                    color: COLORS.orange,
                    borderRadius: 8,
                    padding: "12px 14px",
                    minHeight: 44,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {open ? "Close Brief" : "Read Brief"}
                </button>

                {open && (
                  <div
                    style={{
                      marginTop: 14,
                      borderTop: `1px solid ${COLORS.border}`,
                      paddingTop: 12,
                    }}
                  >
                    <ul style={{ paddingLeft: 18, margin: 0 }}>
                      {lesson.points.map((point) => (
                        <li
                          key={point}
                          style={{
                            color: COLORS.text,
                            fontSize: 14,
                            lineHeight: "22px",
                            marginBottom: 6,
                          }}
                        >
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section
          style={{
            marginTop: 20,
            ...cardStyle(),
            background: COLORS.bgSecondary,
          }}
        >
          <h3 style={{ color: COLORS.text, fontSize: 20, fontWeight: 700 }}>
            Ready to apply what you learned?
          </h3>
          <p
            style={{
              marginTop: 6,
              color: COLORS.muted,
              fontSize: 14,
              lineHeight: "22px",
            }}
          >
            Continue to Perch's market view and review listed companies before
            placing your next simulated trade.
          </p>
          <Link
            href="/markets"
            style={{
              display: "inline-block",
              marginTop: 12,
              background: COLORS.orange,
              color: "#FFFFFF",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Open Markets
          </Link>
        </section>
      </div>
    </div>
  );
}
