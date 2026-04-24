import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Perch Capital",
  description: "How Perch Capital collects, uses, and protects your information.",
};

const LAST_UPDATED = "April 24, 2026";

export default function PrivacyPolicyPage() {
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
          Privacy Policy
        </h1>
        <p style={{ margin: "0 0 32px", fontSize: 14, color: "#78716c" }}>
          Last updated: {LAST_UPDATED}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 28, color: "#3f3f3f", fontSize: 15, lineHeight: 1.7 }}>
          <section>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>Introduction</h2>
            <p style={{ margin: 0 }}>
              Perch Capital (“Perch,” “we,” “us”) operates the Perch application and website. This Privacy Policy
              describes how we collect, use, store, and share information when you use our services.
            </p>
          </section>

          <section>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>
              Information we collect
            </h2>
            <p style={{ margin: "0 0 12px" }}>We may collect the following categories of information:</p>
            <ul style={{ margin: 0, paddingLeft: 22 }}>
              <li style={{ marginBottom: 8 }}>
                <strong style={{ color: "#292524" }}>Account information</strong> — such as identifiers and profile
                details you provide when you create or manage an account.
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong style={{ color: "#292524" }}>Google sign-in</strong> — if you choose Google authentication, we
                may receive your name and email address (and related account identifiers) as made available by Google
                for sign-in purposes.
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong style={{ color: "#292524" }}>App usage data</strong> — such as how you navigate and interact
                with the product, feature usage, and technical logs that help us operate and improve the service.
              </li>
              <li style={{ marginBottom: 0 }}>
                <strong style={{ color: "#292524" }}>Simulated activity</strong> — including your simulated portfolio and
                paper trade activity within Perch.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>How we use information</h2>
            <p style={{ margin: "0 0 12px" }}>We use this information to:</p>
            <ul style={{ margin: 0, paddingLeft: 22 }}>
              <li style={{ marginBottom: 8 }}>Authenticate you and secure your account;</li>
              <li style={{ marginBottom: 8 }}>Save your progress and sync your simulated portfolio experience;</li>
              <li style={{ marginBottom: 8 }}>Improve product experience, reliability, and performance;</li>
              <li style={{ marginBottom: 8 }}>Run analytics to understand aggregate usage and inform product decisions;</li>
              <li style={{ marginBottom: 0 }}>
                Notify you about product access, updates, and relevant service communications where permitted.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>Google Sign-In</h2>
            <p style={{ margin: 0 }}>
              Perch uses Google account information only for authentication and account setup. We do not access Google
              Drive, Gmail, Google Contacts, or other unrelated Google data as part of providing Perch.
            </p>
          </section>

          <section>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>Storage and service providers</h2>
            <p style={{ margin: 0 }}>
              Data may be stored and processed using trusted third-party providers — for example, infrastructure and
              database services such as Supabase, and analytics providers — to host, secure, and operate the product.
            </p>
          </section>

          <section>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>Sharing and sales</h2>
            <p style={{ margin: 0 }}>Perch does not sell your personal data.</p>
          </section>

          <section>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>Deletion and contact</h2>
            <p style={{ margin: 0 }}>
              You may request account or personal data deletion by contacting us at{" "}
              <a href="mailto:hello@joinperch.me" className="home-signin-link">
                hello@joinperch.me
              </a>
              . We will respond in line with applicable requirements and our operational capabilities.
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
