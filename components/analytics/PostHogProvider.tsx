"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { registerAttributionProperties } from "@/lib/analytics/client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

function PostHogPageviewTracker() {
  const pathname = usePathname();
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    // Read URL from window in a client effect to avoid App Router
    // prerender/searchParams constraints.
    const currentUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : pathname;
    if (lastUrlRef.current === currentUrl) return;
    lastUrlRef.current = currentUrl;
    posthog.capture("$pageview", {
      $current_url: currentUrl,
    });
  }, [pathname]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: false,
      capture_pageleave: true,
      persistence: "localStorage+cookie",
    });
    registerAttributionProperties();
    if (
      process.env.NODE_ENV === "development" &&
      typeof window !== "undefined" &&
      !window.sessionStorage.getItem("posthog_test_event_fired")
    ) {
      posthog.capture("posthog_test_event", {
        source: "PostHogProvider",
      });
      window.sessionStorage.setItem("posthog_test_event_fired", "1");
    }
    setIsReady(true);
  }, []);

  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      {isReady ? <PostHogPageviewTracker /> : null}
      {children}
    </PHProvider>
  );
}
