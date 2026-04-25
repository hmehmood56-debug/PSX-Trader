import { createClient } from "@/utils/supabase/server";
import type { AnalyticsEventName, AnalyticsMetadata } from "@/lib/analytics/events";

function normalizeMetadata(metadata?: AnalyticsMetadata): AnalyticsMetadata {
  if (!metadata) return {};
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries);
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
    // Ignore analytics failures to avoid impacting product flows.
  }
}
