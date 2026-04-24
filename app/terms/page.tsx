import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Perch Capital",
  description: "Terms governing your use of Perch by Perch Capital.",
};

const LAST_UPDATED = "April 24, 2026";

export default function TermsOfServicePage() {
  return (
    <div
      style={{
        minHeight: "100%",
        background: "linear-gradient(135deg, #fffdf9 0%, #f6f1ea 52%, #f3eee7 100%)",
      }}
    >
      <div
        className="perch-shell"
        style={{
          paddingTop: "clamp(32px, 6vw, 56px)",
          paddingBottom: "clamp(48px, 10vw, 96px)",
          maxWidth: 720,
        }}
      >
        <p style={{ margin: "0 0 20px", fontSize: 11, letterSpacing: "0.14em", fontWeight: 600, color: "#a8a29a" }}>
          PERCH CAPITAL
        </p>
        <h1
          style={{
            margin: "0 0 12px",
            fontSize: "clamp(28px, 5vw, 36px)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#1a1a1a",
            lineHeight: 1.15,
          }}
        >
          Terms of Service
        </h1>
        <p style={{ margin: "0 0 32px", fontSize: 14, color: "#78716c" }}>
          Last updated: {LAST_UPDATED}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 28, color: "#3f3f3f", fontSize: 15, lineHeight: 1.7 }}>
          <section>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>Agreement</h2>
            <p style={{ margin: 0 }}>
              By accessing or using Perch, you agree to these Terms of Service. If you do not agree, do not use the
              service.
            </p>
          </section>

          <section>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>
              Educational and simulated platform
            </h2>
            <p style={{ margin: 0 }}>
              Perch is an educational and simulated investing experience. Virtual portfolios, paper trades, and related
              activity are simulations only. They are not real financial transactions, do not involve real brokerage
              execution through Perch in this mode, and do not create real-world positions or obligations.
            </p>
          </section>

          <section>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>Not financial advice</h2>
            <p style={{ margin: 0 }}>
              Nothing on Perch is financial, investment, legal, or tax advice. You are solely responsible for your own
              investment decisions and for seeking professional advice where appropriate.
            </p>
          </section>

          <section>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>Future real trading</h2>
            <p style={{ margin: 0 }}>
              If Perch offers live or real-money trading in the future, access may require separate agreements,
              eligibility checks, and compliance steps. Simulated use today does not guarantee future access to real
              trading.
            </p>
          </section>

          <section>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>Acceptable use</h2>
            <p style={{ margin: 0 }}>
              You agree not to misuse the service — including attempting to disrupt, scrape, reverse engineer, or access
              systems without authorization, or use Perch in violation of applicable law. We may suspend or terminate
              access for conduct that risks the product, other users, or our operations.
            </p>
          </section>

          <section>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>Your account</h2>
            <p style={{ margin: 0 }}>
              You are responsible for safeguarding your credentials and for activity under your account. Notify us if you
              believe your account has been compromised.
            </p>
          </section>

          <section>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>Limitation of liability</h2>
            <p style={{ margin: 0 }}>
              To the fullest extent permitted by law, Perch Capital and its affiliates are not liable for any indirect,
              incidental, special, consequential, or punitive damages, or for loss of profits, data, or goodwill,
              arising from your use of or inability to use Perch. The service is provided “as is” without warranties of
              any kind except where required by law.
            </p>
          </section>

          <section>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>Contact</h2>
            <p style={{ margin: 0 }}>
              Questions about these terms:{" "}
              <a href="mailto:hello@joinperch.me" className="home-signin-link">
                hello@joinperch.me
              </a>
            </p>
          </section>

          <section
            style={{
              marginTop: 8,
              paddingTop: 24,
              borderTop: "1px solid rgba(203, 97, 23, 0.18)",
            }}
          >
            <p style={{ margin: 0, fontSize: 14, color: "#78716c" }}>
              <Link href="/" className="home-signin-link">
                ← Back to home
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
