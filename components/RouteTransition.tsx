"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, type ReactNode } from "react";

function RouteTransitionInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeId = `${pathname}?${searchParams.toString()}`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef(true);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    const el = wrapRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.remove("perch-route-enter");
    void el.offsetWidth;
    el.classList.add("perch-route-enter");
  }, [routeId]);

  return (
    <div ref={wrapRef} className="perch-route-transition-root">
      {children}
    </div>
  );
}

export function RouteTransition({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="perch-route-transition-root">{children}</div>}>
      <RouteTransitionInner>{children}</RouteTransitionInner>
    </Suspense>
  );
}
