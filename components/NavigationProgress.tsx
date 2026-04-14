"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { registerRouteProgressStart } from "@/lib/routeProgress";
import styles from "./NavigationProgress.module.css";

type Phase = "hidden" | "kick" | "crawl" | "flush" | "fade";

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [phase, setPhase] = useState<Phase>("hidden");
  const routeKeyRef = useRef<string | null>(null);
  const pendingRef = useRef(false);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSafety = useCallback(() => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clearSafety();
    pendingRef.current = true;
    setPhase("kick");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("crawl"));
    });
    safetyTimerRef.current = setTimeout(() => {
      pendingRef.current = false;
      setPhase((p) => (p === "hidden" ? "hidden" : "flush"));
    }, 12_000);
  }, [clearSafety]);

  const armComplete = useCallback(() => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    clearSafety();
    setPhase((p) => (p === "hidden" ? "hidden" : "flush"));
  }, [clearSafety]);

  useEffect(() => {
    registerRouteProgressStart(start);
    return () => {
      clearSafety();
      registerRouteProgressStart(() => {});
    };
  }, [start, clearSafety]);

  useEffect(() => {
    if (routeKeyRef.current === null) {
      routeKeyRef.current = routeKey;
      return;
    }
    if (routeKeyRef.current === routeKey) return;
    routeKeyRef.current = routeKey;
    armComplete();
  }, [routeKey, armComplete]);

  useEffect(() => {
    if (phase !== "flush") return;
    const t = window.setTimeout(() => setPhase("fade"), 240);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "fade") return;
    const t = window.setTimeout(() => setPhase("hidden"), 430);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const a = el?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      const raw = a.getAttribute("href");
      if (!raw || raw.startsWith("#")) return;
      let url: URL;
      try {
        url = new URL(raw, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      const next = `${url.pathname}${url.search}`;
      const cur = `${window.location.pathname}${window.location.search}`;
      if (next === cur) return;
      start();
    };

    const onPopState = () => start();

    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [start]);

  if (phase === "hidden") return null;

  return (
    <div className={styles.track} aria-hidden>
      <div className={styles.fill} data-phase={phase} />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
