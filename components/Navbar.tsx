"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
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
        height: 72,
        background: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid #ECE8E4",
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
            <span style={{ color: "#1A1A1A", fontWeight: 700, fontSize: 22 }}>
              Perch
            </span>
            <span style={{ color: "#5E5E5E", fontWeight: 500, fontSize: 13 }}>
              Capital
            </span>
          </div>
          <span
            style={{
              color: "#C45000",
              fontSize: 11,
              fontWeight: 600,
              border: "1px solid #E8D4C7",
              background: "#FBF4EF",
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
                  color: active ? "#C45000" : "#4E4E4E",
                  background: active ? "#FBF4EF" : "transparent",
                  border: active ? "1px solid #E8D4C7" : "1px solid transparent",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
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
          <Link
            href="/stocks"
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 6,
              border: "1px solid #E5E5E5",
              background: "transparent",
              color: "#1A1A1A",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Explore Markets
          </Link>
          <Link
            href="/dashboard"
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 6,
              border: "1px solid #C45000",
              background: "#C45000",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Start Investing
          </Link>
        </div>
      </div>
    </header>
  );
}
