import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export async function toggleFeatureFlagAction(formData: FormData) {
  "use server";
  const field = String(formData.get("field") ?? "");
  const value = String(formData.get("value") ?? "");
  const enabledField = String(formData.get("enabled_field") ?? "");
  const currentEnabled = String(formData.get("current_enabled") ?? "") === "true";

  if (!field || !value || !enabledField) return;

  const supabase = createClient();
  await supabase
    .from("feature_flags")
    .update({ [enabledField]: !currentEnabled })
    .eq(field, value);

  revalidatePath("/admin");
}
