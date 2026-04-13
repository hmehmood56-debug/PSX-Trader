"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/stocks", label: "Stocks" },
  { href: "/portfolio", label: "Portfolio" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="w-full bg-fintech-brand">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-4 px-4 py-3 md:grid-cols-3">
        <Link href="/" className="flex items-baseline gap-1.5 justify-self-start">
          <span className="text-lg font-bold tracking-tight text-white">PSX</span>
          <span className="text-lg font-light tracking-tight text-white">
            Trader
          </span>
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-1 md:gap-2">
          {links.map((l) => {
            const active =
              l.href === "/"
                ? pathname === "/"
                : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-btn px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white font-semibold text-fintech-brand"
                    : "text-white hover:bg-white/10"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center justify-end gap-2 justify-self-end">
          <button
            type="button"
            className="rounded-btn border border-white bg-transparent px-4 py-2 text-sm font-medium text-white"
          >
            Log In
          </button>
          <button
            type="button"
            className="rounded-btn bg-white px-4 py-2 text-sm font-semibold text-fintech-brand"
          >
            Sign Up
          </button>
        </div>
      </div>
    </header>
  );
}
