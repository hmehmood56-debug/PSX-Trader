import { createClient } from "@/utils/supabase/server";

type FeatureFlagRow = Record<string, unknown>;

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getFlagEnabled(flag: FeatureFlagRow): boolean | null {
  if (typeof flag.enabled === "boolean") return flag.enabled;
  if (typeof flag.is_enabled === "boolean") return flag.is_enabled;
  if (typeof flag.active === "boolean") return flag.active;
  return null;
}

function flagMatches(flag: FeatureFlagRow, aliases: readonly string[]): boolean {
  const candidates = [flag.id, flag.key, flag.slug, flag.name, flag.label]
    .map(normalizeText)
    .filter(Boolean);
  return candidates.some((candidate) => aliases.some((alias) => candidate.includes(alias)));
}

async function getAdminAndFlags() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: flags }] = await Promise.all([
    user
      ? supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("feature_flags").select("*"),
  ]);

  return {
    isAdmin: profile?.role === "admin",
    flags: (flags as FeatureFlagRow[] | null) ?? [],
  };
}

export async function canAccessIntelligence(): Promise<boolean> {
  const { isAdmin, flags } = await getAdminAndFlags();
  if (isAdmin) return true;

  const intelligenceFlag = flags.find((flag) =>
    flagMatches(flag, ["intelligence", "perch_intelligence", "ai_guidance"])
  );
  return getFlagEnabled(intelligenceFlag ?? {}) === true;
}

export async function canAccessStagedMarketModule(
  module: "currencies" | "indices"
): Promise<boolean> {
  const { isAdmin, flags } = await getAdminAndFlags();
  if (isAdmin) return true;

  const aliases =
    module === "currencies"
      ? ["currencies", "currency", "fx", "forex"]
      : ["indices", "index", "global_indices", "global-index"];
  const moduleFlag = flags.find((flag) => flagMatches(flag, aliases));
  return getFlagEnabled(moduleFlag ?? {}) === true;
}
