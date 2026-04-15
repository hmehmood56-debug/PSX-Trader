"use client";

import { PerchWordmark } from "@/components/PerchWordmark";
import type { ReactNode } from "react";
import styles from "./AuthShell.module.css";

type AuthShellProps = {
  kicker?: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({ kicker, title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className={styles.page}>
      <div className={styles.pageGlow} aria-hidden />
      <div className={styles.pageGlow2} aria-hidden />
      <div className={`perch-shell ${styles.inner}`}>
        <div className={styles.card}>
          <div className={styles.cardTopBar} aria-hidden />
          <div className={styles.cardInner}>
            <div className={styles.brandRow}>
              <PerchWordmark />
              {kicker ? <span className={styles.kicker}>{kicker}</span> : null}
            </div>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
            <div className={styles.formBlock}>{children}</div>
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}
