"use client";

import { createClient } from "@/utils/supabase/client";
import type { AnalyticsEventName, AnalyticsMetadata } from "@/lib/analytics/events";

const RETURN_VISIT_KEY = "perch_last_visit_at";

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
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("analytics_events").insert({
      user_id: user?.id ?? null,
      event_name: eventName,
      metadata: normalizeMetadata(metadata),
      created_at: new Date().toISOString(),
    });
  } catch {
    // Analytics must never interrupt user-facing flows.
  }
}
