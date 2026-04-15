import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { CSSProperties, ReactNode } from "react";
import { toggleFeatureFlagAction } from "@/app/admin/actions";

type SignupRow = {
  id: string;
  username: string | null;
  created_at?: string | null;
};

type AnalyticsRow = {
  id: string;
  event_name: string;
  created_at?: string | null;
};

type FeatureFlagRow = Record<string, unknown>;

type TimeRange = "today" | "7d" | "30d" | "all";

type AdminPageProps = {
  searchParams?: {
    range?: string;
  };
};

const TIME_RANGES: TimeRange[] = ["today", "7d", "30d", "all"];

const FUNNEL_EVENT_ALIASES = {
  signups: ["signup_completed", "signup_success", "signup"],
  onboardingCompleted: ["onboarding_completed", "onboarding_done"],
  firstTrade: ["first_trade", "trade_first_executed", "first_trade_executed"],
  returnVisits: ["return_visit", "session_return", "dashboard_viewed"],
} as const;

function formatTimestamp(value?: string | null): string {
  if (!value) return "Unknown time";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return parsed.toLocaleString("en-PK", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toTimeRange(value?: string): TimeRange {
  if (!value) return "all";
  return TIME_RANGES.includes(value as TimeRange) ? (value as TimeRange) : "all";
}

function getRangeStart(range: TimeRange): string | null {
  if (range === "all") return null;
  const now = new Date();
  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  const days = range === "7d" ? 7 : 30;
  const start = new Date(now);
  start.setDate(now.getDate() - days);
  return start.toISOString();
}

function applyGteFilter<T>(query: T, column: string, startAtIso: string | null): T {
  if (!startAtIso) return query;
  return (query as { gte: (col: string, val: string) => T }).gte(column, startAtIso);
}

function normalizeEventName(value: string): string {
  return value.trim().toLowerCase();
}

function countEventAliases(
  groupedEvents: Map<string, number>,
  aliases: readonly string[]
): number {
  return aliases.reduce((sum, alias) => sum + (groupedEvents.get(alias) ?? 0), 0);
}

function getFlagIdentifier(flag: FeatureFlagRow): { field: string; value: string } | null {
  if (typeof flag.id === "string" && flag.id.length > 0) {
    return { field: "id", value: flag.id };
  }
  if (typeof flag.key === "string" && flag.key.length > 0) {
    return { field: "key", value: flag.key };
  }
  return null;
}

function getFlagEnabled(flag: FeatureFlagRow): { field: string; value: boolean } | null {
  if (typeof flag.enabled === "boolean") {
    return { field: "enabled", value: flag.enabled };
  }
  if (typeof flag.is_enabled === "boolean") {
    return { field: "is_enabled", value: flag.is_enabled };
  }
  if (typeof flag.active === "boolean") {
    return { field: "active", value: flag.active };
  }
  return null;
}

function getFlagLabel(flag: FeatureFlagRow): string {
  const candidates = [flag.name, flag.label, flag.key, flag.slug, flag.id];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return "Feature Flag";
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const supabase = createClient();
  const selectedRange = toTimeRange(searchParams?.range);
  const startAt = getRangeStart(selectedRange);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const profileCountQuery = applyGteFilter(
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    "created_at",
    startAt
  );
  const analyticsCountQuery = applyGteFilter(
    supabase.from("analytics_events").select("*", { count: "exact", head: true }),
    "created_at",
    startAt
  );
  const recentSignupsQuery = applyGteFilter(
    supabase
      .from("profiles")
      .select("id, username, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    "created_at",
    startAt
  );
  const recentEventsQuery = applyGteFilter(
    supabase
      .from("analytics_events")
      .select("id, event_name, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    "created_at",
    startAt
  );
  const analyticsForGroupingQuery = applyGteFilter(
    supabase.from("analytics_events").select("event_name").limit(5000),
    "created_at",
    startAt
  );

  const [
    { count: totalUsers = 0 },
    { count: totalAnalyticsEvents = 0 },
    snapshotsResult,
    recentSignupsResult,
    recentEventsResult,
    analyticsForGroupingResult,
    featureFlagsResult,
  ] = await Promise.all([
    profileCountQuery,
    analyticsCountQuery,
    supabase.from("portfolio_snapshots").select("transactions"),
    recentSignupsQuery,
    recentEventsQuery,
    analyticsForGroupingQuery,
    supabase.from("feature_flags").select("*").order("created_at", { ascending: true }),
  ]);

  const totalTradesExecuted = (snapshotsResult.data ?? []).reduce((sum, row) => {
    const txs = (row as { transactions?: unknown }).transactions;
    return sum + (Array.isArray(txs) ? txs.length : 0);
  }, 0);

  const recentSignups: SignupRow[] = recentSignupsResult.error
    ? []
    : (recentSignupsResult.data as SignupRow[] | null) ?? [];

  const recentEvents: AnalyticsRow[] = recentEventsResult.error
    ? []
    : (recentEventsResult.data as AnalyticsRow[] | null) ?? [];

  const featureFlags: FeatureFlagRow[] = featureFlagsResult.error
    ? []
    : (featureFlagsResult.data as FeatureFlagRow[] | null) ?? [];

  const groupedEvents = new Map<string, number>();
  for (const row of analyticsForGroupingResult.data ?? []) {
    const raw = (row as { event_name?: unknown }).event_name;
    if (typeof raw !== "string" || raw.trim().length === 0) continue;
    const key = normalizeEventName(raw);
    groupedEvents.set(key, (groupedEvents.get(key) ?? 0) + 1);
  }

  const funnelSignups = countEventAliases(groupedEvents, FUNNEL_EVENT_ALIASES.signups);
  const funnelOnboardingCompleted = countEventAliases(
    groupedEvents,
    FUNNEL_EVENT_ALIASES.onboardingCompleted
  );
  const funnelFirstTrade = countEventAliases(groupedEvents, FUNNEL_EVENT_ALIASES.firstTrade);
  const funnelReturnVisits = countEventAliases(groupedEvents, FUNNEL_EVENT_ALIASES.returnVisits);

  const topEvents = Array.from(groupedEvents.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <div
      style={{
        background:
          "radial-gradient(900px 380px at 86% -8%, rgba(196, 80, 0, 0.11) 0%, rgba(196, 80, 0, 0) 68%), #FFFFFF",
      }}
    >
      <div className="perch-shell perch-shell-wide perch-psx-shell">
        <section className="dashboard-header">
          <div>
            <p
              style={{
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: "#856B58",
              }}
            >
              Perch Internal
            </p>
            <h1>Admin Control Room</h1>
            <p>Internal visibility for usage and platform activity.</p>
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TIME_RANGES.map((range) => {
                const active = selectedRange === range;
                const href = range === "all" ? "/admin" : `/admin?range=${range}`;
                return (
                  <a
                    key={range}
                    href={href}
                    style={{
                      border: active ? "1px solid #C45000" : "1px solid #e8ddd3",
                      borderRadius: 999,
                      background: active ? "#FFF5EE" : "#FFFFFF",
                      color: active ? "#A84200" : "#5F5F5F",
                      padding: "6px 12px",
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    {range}
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <section className="perch-dashboard-stats">
          <MetricCard label="Total Users" value={String(totalUsers)} />
          <MetricCard label="Total Analytics Events" value={String(totalAnalyticsEvents)} />
          <MetricCard label="Total Trades Executed" value={String(totalTradesExecuted)} />
        </section>

        <section className="perch-dashboard-stats" style={{ marginTop: 12 }}>
          <MetricCard label="Funnel: Signups" value={String(funnelSignups)} />
          <MetricCard
            label="Funnel: Onboarding Completed"
            value={String(funnelOnboardingCompleted)}
          />
          <MetricCard label="Funnel: First Trade" value={String(funnelFirstTrade)} />
          <MetricCard label="Funnel: Return Visits" value={String(funnelReturnVisits)} />
        </section>

        <section
          className="perch-dashboard-two-col"
          style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}
        >
          <Panel title="Recent Signups">
            {recentSignups.length === 0 ? (
              <EmptyState text="No signup records available." />
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {recentSignups.map((signup) => (
                  <li key={signup.id} style={rowStyle()}>
                    <div style={{ fontWeight: 620, color: "#212121" }}>
                      {signup.username ?? "Unnamed user"}
                    </div>
                    <div style={{ fontSize: 12, color: "#737373" }}>
                      {formatTimestamp(signup.created_at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent Analytics Events">
            {recentEvents.length === 0 ? (
              <EmptyState text="No analytics records available." />
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {recentEvents.map((event) => (
                  <li key={event.id} style={rowStyle()}>
                    <div style={{ fontWeight: 620, color: "#212121" }}>
                      {event.event_name}
                    </div>
                    <div style={{ fontSize: 12, color: "#737373" }}>
                      {formatTimestamp(event.created_at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>

        <section
          style={{
            marginTop: 16,
            border: "1px solid #ebe3db",
            borderRadius: 16,
            background: "linear-gradient(180deg, #FFFFFF 0%, #FCFAF8 100%)",
            boxShadow: "0 10px 24px rgba(24, 24, 24, 0.05)",
            padding: 18,
          }}
        >
          <h2
            style={{
              fontSize: 18,
              letterSpacing: "-0.01em",
              color: "#1D1D1D",
              marginBottom: 6,
            }}
          >
            Feature Controls
          </h2>
          <p style={{ fontSize: 13, color: "#6F6F6F", marginBottom: 12 }}>
            Live controls powered by `public.feature_flags`.
          </p>
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            {featureFlags.length === 0 ? (
              <EmptyState text="No feature flags found." />
            ) : (
              featureFlags.map((flag, index) => {
                const identifier = getFlagIdentifier(flag);
                const enabled = getFlagEnabled(flag);
                const label = getFlagLabel(flag);
                const canToggle = Boolean(identifier && enabled);
                return (
                  <form
                    key={identifier?.value ?? `${label}-${index}`}
                    action={toggleFeatureFlagAction}
                    style={{
                      border: "1px solid #ebe3db",
                      borderRadius: 12,
                      background: "#FFFFFF",
                      padding: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 13, color: "#2A2A2A", fontWeight: 600 }}>{label}</span>
                    <input type="hidden" name="field" value={identifier?.field ?? ""} />
                    <input type="hidden" name="value" value={identifier?.value ?? ""} />
                    <input type="hidden" name="enabled_field" value={enabled?.field ?? ""} />
                    <input
                      type="hidden"
                      name="current_enabled"
                      value={enabled?.value ? "true" : "false"}
                    />
                    <button
                      type="submit"
                      disabled={!canToggle}
                      aria-label={`Toggle ${label}`}
                      style={{
                        border: enabled?.value ? "1px solid #C45000" : "1px solid #dcd2c9",
                        borderRadius: 999,
                        background: enabled?.value ? "#FFF2E8" : "#F4F4F4",
                        color: enabled?.value ? "#AA4300" : "#7D7D7D",
                        minWidth: 68,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        padding: "6px 12px",
                        cursor: canToggle ? "pointer" : "not-allowed",
                      }}
                    >
                      {enabled?.value ? "On" : "Off"}
                    </button>
                  </form>
                );
              })
            )}
          </div>
        </section>

        <section style={{ marginTop: 16 }}>
          <Panel title="Top Events">
            {topEvents.length === 0 ? (
              <EmptyState text="No event activity for this time range." />
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                {topEvents.map(([eventName, count]) => (
                  <li key={eventName} style={rowStyle()}>
                    <span style={{ fontWeight: 620, color: "#212121" }}>{eventName}</span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "#626262",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 700,
                      }}
                    >
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #FFFFFF 0%, #FCFCFC 100%)",
        border: "1px solid #E8E8E8",
        borderRadius: 16,
        padding: 22,
        boxShadow: "0 10px 26px rgba(26, 26, 26, 0.05)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#6B6B6B",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 12,
          fontSize: "clamp(28px, 4vw, 34px)",
          lineHeight: 1.04,
          letterSpacing: "-0.02em",
          fontWeight: 760,
          color: "#1A1A1A",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #ebe3db",
        borderRadius: 16,
        background: "linear-gradient(180deg, #FFFFFF 0%, #FCFAF8 100%)",
        boxShadow: "0 10px 24px rgba(24, 24, 24, 0.05)",
        padding: 18,
      }}
    >
      <h2
        style={{
          fontSize: 16,
          letterSpacing: "-0.01em",
          color: "#1D1D1D",
          marginBottom: 10,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p style={{ color: "#777", fontSize: 13 }}>{text}</p>;
}

function rowStyle(): CSSProperties {
  return {
    border: "1px solid #EFE7DF",
    borderRadius: 10,
    background: "#FFFFFF",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  };
}
