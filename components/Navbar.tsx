"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import styles from "./Navbar.module.css";
import { PerchWordmark } from "./PerchWordmark";

const desktopLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/markets", label: "Markets" },
];

const mobileLinks = [
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
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const signedInLabel = user ? accountLabel(user) : "";
  /** One of three mutually exclusive UI modes. Never mix guest and signed-in controls in the same render. */
  const authMode = authLoading ? "loading" : user ? "signedIn" : "guest";

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
    setMoreOpen(false);
  }, [pathname, closeMenu]);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!moreMenuRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [moreOpen]);

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
          <PerchWordmark className={styles.brandWordmark} tone="navbar" />
          {authMode === "guest" ? <span className={styles.previewPill}>Preview</span> : null}
        </Link>

        <nav className={styles.desktopNav} aria-label="Primary">
          {desktopLinks.map((l) => {
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
            <span className={styles.authLoadingSlot} aria-hidden />
            <div className={styles.moreMenuWrap} ref={moreMenuRef}>
              <button
                type="button"
                className={styles.moreButton}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((open) => !open)}
              >
                More ▾
              </button>
              {moreOpen ? (
                <div className={styles.moreMenu} role="menu">
                  <Link href="/account" className={styles.moreMenuItem} role="menuitem" onClick={() => setMoreOpen(false)}>
                    Account
                  </Link>
                  <a
                    href="mailto:hello@joinperch.me?subject=Perch%20Inquiry"
                    className={styles.moreMenuItem}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                  >
                    Contact
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        ) : authMode === "signedIn" ? (
          <div className={styles.desktopCtas}>
            <span className={styles.userLabel} title={user?.email ?? undefined}>
              {signedInLabel}
            </span>
            <div className={styles.moreMenuWrap} ref={moreMenuRef}>
              <button
                type="button"
                className={styles.moreButton}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((open) => !open)}
              >
                More ▾
              </button>
              {moreOpen ? (
                <div className={styles.moreMenu} role="menu">
                  <Link href="/account" className={styles.moreMenuItem} role="menuitem" onClick={() => setMoreOpen(false)}>
                    Account
                  </Link>
                  <a
                    href="mailto:hello@joinperch.me?subject=Perch%20Inquiry"
                    className={styles.moreMenuItem}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                  >
                    Contact
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className={styles.desktopCtas}>
            <Link href="/signin" className={styles.ctaSignIn}>
              Sign in
            </Link>
            <Link href="/signup" className={styles.ctaCreateAccount}>
              Create account
            </Link>
            <Link href="/start" className={styles.ctaPrimary}>
              Start Here <span aria-hidden>→</span>
            </Link>
            <div className={styles.moreMenuWrap} ref={moreMenuRef}>
              <button
                type="button"
                className={styles.moreButton}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((open) => !open)}
              >
                More ▾
              </button>
              {moreOpen ? (
                <div className={styles.moreMenu} role="menu">
                  <Link href="/account" className={styles.moreMenuItem} role="menuitem" onClick={() => setMoreOpen(false)}>
                    Account
                  </Link>
                  <a
                    href="mailto:hello@joinperch.me?subject=Perch%20Inquiry"
                    className={styles.moreMenuItem}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                  >
                    Contact
                  </a>
                </div>
              ) : null}
            </div>
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
          {mobileLinks.map((l) => {
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
            <div className={styles.mobileAuthLoadingSlot} aria-hidden />
          </div>
        ) : authMode === "signedIn" ? null : (
          <div className={styles.mobileCtas}>
            <Link href="/signin" className={styles.mobileCtaSecondary} onClick={closeMenu}>
              Sign in
            </Link>
            <Link href="/signup" className={styles.mobileCtaSecondary} onClick={closeMenu}>
              Create account
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
