"use client";

import posthog from "posthog-js";
import type { AnalyticsEventName, AnalyticsMetadata } from "@/lib/analytics/events";

const RETURN_VISIT_KEY = "perch_last_visit_at";
const ATTRIBUTION_REGISTERED_KEY = "perch_attribution_registered";

function normalizeMetadata(metadata?: AnalyticsMetadata): AnalyticsMetadata {
  if (!metadata) return {};
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries);
}

export function getLastVisitTimestamp(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(RETURN_VISIT_KEY);
}

export function markVisitTimestamp() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RETURN_VISIT_KEY, new Date().toISOString());
}

export async function logAnalyticsEvent(
  eventName: AnalyticsEventName,
  metadata?: AnalyticsMetadata
) {
  try {
    if (typeof window === "undefined") return;
    posthog.capture(eventName, normalizeMetadata(metadata));
  } catch {
    // Analytics must never interrupt user-facing flows.
  }
}

export function registerAttributionProperties() {
  if (typeof window === "undefined") return;
  if (window.sessionStorage.getItem(ATTRIBUTION_REGISTERED_KEY)) return;

  const query = new URLSearchParams(window.location.search);
  const attribution = {
    initial_referrer: document.referrer || null,
    landing_path: window.location.pathname,
    landing_query: window.location.search || null,
    utm_source: query.get("utm_source"),
    utm_medium: query.get("utm_medium"),
    utm_campaign: query.get("utm_campaign"),
    utm_term: query.get("utm_term"),
    utm_content: query.get("utm_content"),
  };

  posthog.register_once(normalizeMetadata(attribution));
  window.sessionStorage.setItem(ATTRIBUTION_REGISTERED_KEY, "1");
}

export function identifyAnalyticsUser(userId: string, metadata?: AnalyticsMetadata) {
  try {
    posthog.identify(userId, normalizeMetadata(metadata));
  } catch {
    // Analytics must never interrupt user-facing flows.
  }
}

export function resetAnalyticsUser() {
  try {
    posthog.reset();
  } catch {
    // Analytics must never interrupt user-facing flows.
  }
}
