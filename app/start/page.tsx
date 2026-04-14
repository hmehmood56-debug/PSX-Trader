import type { Metadata } from "next";
import { GuidedOnboarding } from "@/components/onboarding/GuidedOnboarding";

export const metadata: Metadata = {
  title: "Start here | Perch",
  description: "A short guided setup for your first practice PSX trade with Perch.",
};

export default function StartHerePage() {
  return <GuidedOnboarding />;
}
