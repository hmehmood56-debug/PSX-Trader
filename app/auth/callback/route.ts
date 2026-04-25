import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinperch.me";
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const mode = url.searchParams.get("mode") ?? "signin";
  const source = url.searchParams.get("source") ?? "google";
  const onboardingCompleted = url.searchParams.get("onboardingCompleted") ?? "false";

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const finishUrl = new URL("/auth/finish", siteUrl);
  finishUrl.searchParams.set("next", next.startsWith("/") ? next : "/dashboard");
  finishUrl.searchParams.set("mode", mode === "signup" ? "signup" : "signin");
  finishUrl.searchParams.set("source", source);
  finishUrl.searchParams.set("onboardingCompleted", onboardingCompleted);

  return NextResponse.redirect(finishUrl);
}
