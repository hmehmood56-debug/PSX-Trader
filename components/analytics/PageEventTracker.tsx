"use client";

import { logAnalyticsEvent } from "@/lib/analytics/client";
import type { AnalyticsEventName, AnalyticsMetadata } from "@/lib/analytics/events";
import { useEffect } from "react";

export function PageEventTracker({
  eventName,
  metadata,
}: {
  eventName: AnalyticsEventName;
  metadata?: AnalyticsMetadata;
}) {
  useEffect(() => {
    void logAnalyticsEvent(eventName, metadata);
  }, [eventName, metadata]);

  return null;
}
