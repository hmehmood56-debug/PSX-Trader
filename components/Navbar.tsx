"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import styles from "./Navbar.module.css";
import { PerchWordmark } from "./PerchWordmark";

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/markets", label: "Markets" },
  { href: "/account", label: "Account" },
];

function accountLabel(user: { email?: string | null; user_metadata?: Record<string, unknown> }): string {
  const u = user.user_metadata?.username;
  if (typeof u === "string" && u.trim()) return u.trim();
  const e = user.email?.split("@")[0];
  return e && e.trim() ? e.trim() : "My Account";
}

export function Navbar() {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const signedInLabel = user ? accountLabel(user) : "";
  /** One of three mutually exclusive UI modes. Never mix guest and signed-in controls in the same render. */
  const authMode = authLoading ? "loading" : user ? "signedIn" : "guest";

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
          <PerchWordmark />
          {authMode === "guest" ? <span className={styles.previewPill}>Preview</span> : null}
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

        {authMode === "loading" ? (
          <div className={styles.desktopCtas}>
            <Link href="/waitlist" className={styles.ctaWaitlist}>
              Join Waitlist
            </Link>
            <span className={styles.authLoadingSlot} aria-hidden />
          </div>
        ) : authMode === "signedIn" ? (
          <div className={styles.desktopCtas}>
            <Link href="/waitlist" className={styles.ctaWaitlist}>
              Join Waitlist
            </Link>
            <span className={styles.userLabel} title={user?.email ?? undefined}>
              {signedInLabel}
            </span>
          </div>
        ) : (
          <div className={styles.desktopCtas}>
            <Link href="/signin" className={styles.ctaSecondary}>
              Sign in
            </Link>
            <Link href="/signup" className={styles.ctaSecondary}>
              Create account
            </Link>
            <Link href="/waitlist" className={styles.ctaWaitlist}>
              Join Waitlist
            </Link>
            <Link href="/start" className={styles.ctaPrimary}>
              Start Here
            </Link>
          </div>
        )}

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
        {authMode === "signedIn" ? (
          <div className={styles.mobileUserRow}>
            <span className={styles.mobileUserLabel} title={user?.email ?? undefined}>
              {signedInLabel}
            </span>
          </div>
        ) : null}
        {authMode === "loading" ? (
          <div className={styles.mobileCtas}>
            <Link href="/waitlist" className={styles.mobileCtaWaitlist} onClick={closeMenu}>
              Join Waitlist
            </Link>
            <div className={styles.mobileAuthLoadingSlot} aria-hidden />
          </div>
        ) : authMode === "signedIn" ? (
          <div className={styles.mobileCtas}>
            <Link href="/waitlist" className={styles.mobileCtaWaitlist} onClick={closeMenu}>
              Join Waitlist
            </Link>
          </div>
        ) : (
          <div className={styles.mobileCtas}>
            <Link href="/signin" className={styles.mobileCtaSecondary} onClick={closeMenu}>
              Sign in
            </Link>
            <Link href="/signup" className={styles.mobileCtaSecondary} onClick={closeMenu}>
              Create account
            </Link>
            <Link href="/waitlist" className={styles.mobileCtaWaitlist} onClick={closeMenu}>
              Join Waitlist
            </Link>
            <Link href="/start" className={styles.mobileCtaPrimary} onClick={closeMenu}>
              Start Here
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
