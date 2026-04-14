"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import styles from "./Navbar.module.css";

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/markets", label: "Markets" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/account", label: "Account" },
];

export function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const onChange = () => {
      if (mq.matches) setMenuOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <header className={`${styles.header} ${menuOpen ? styles.mobileOpen : ""}`}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} onClick={closeMenu}>
          <div className={styles.brandText}>
            <span className={styles.perchWordmark}>Perch</span>
            <span className={styles.brandCapital}>Capital</span>
          </div>
          <span className={styles.badge}>PSX Market</span>
        </Link>

        <nav className={styles.desktopNav} aria-label="Primary">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.desktopCtas}>
          <Link href="/markets" className={styles.ctaSecondary}>
            Explore Markets
          </Link>
          <Link href="/start" className={styles.ctaPrimary}>
            Start Here
          </Link>
        </div>

        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-panel"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className={styles.menuIcon} aria-hidden>
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close menu"
        tabIndex={menuOpen ? 0 : -1}
        onClick={closeMenu}
      />

      <div id="mobile-nav-panel" className={styles.mobilePanel} role="dialog" aria-modal="true">
        <div className={styles.mobilePanelHeader}>
          <span>Menu</span>
          <button
            type="button"
            className={styles.closeButton}
            aria-label="Close menu"
            onClick={closeMenu}
          >
            ×
          </button>
        </div>
        <nav className={styles.mobileNav} aria-label="Mobile primary">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`${styles.mobileNavLink} ${active ? styles.mobileNavLinkActive : ""}`}
                onClick={closeMenu}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className={styles.mobileCtas}>
          <Link href="/markets" className={styles.mobileCtaSecondary} onClick={closeMenu}>
            Explore Markets
          </Link>
          <Link href="/start" className={styles.mobileCtaPrimary} onClick={closeMenu}>
            Start Here
          </Link>
        </div>
      </div>
    </header>
  );
}
