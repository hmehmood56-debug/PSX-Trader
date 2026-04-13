"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/stocks", label: "Stocks" },
  { href: "/account", label: "Account" },
  { href: "/learn", label: "Learn" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header
      style={{
        width: "100%",
        height: 56,
        background: "#C45000",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1200,
          padding: "0 32px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 20 }}>
              Perch
            </span>
            <span style={{ color: "rgba(255,255,255,0.82)", fontWeight: 400, fontSize: 13 }}>
              Capital
            </span>
          </div>
          <span
            style={{
              color: "#FFFFFF",
              fontSize: 11,
              fontWeight: 600,
              border: "1px solid rgba(255,255,255,0.45)",
              borderRadius: 999,
              padding: "2px 8px",
              letterSpacing: "0.02em",
            }}
          >
            PSX Market
          </span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {links.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  color: active ? "#C45000" : "#FFFFFF",
                  background: active ? "#FFFFFF" : "transparent",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: "none",
                  lineHeight: "20px",
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 6,
              border: "1px solid #FFFFFF",
              background: "transparent",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Log In
          </button>
          <button
            type="button"
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 6,
              border: "1px solid #FFFFFF",
              background: "#FFFFFF",
              color: "#C45000",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Sign Up
          </button>
        </div>
      </div>
    </header>
  );
}
