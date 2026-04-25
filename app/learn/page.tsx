import { redirect } from "next/navigation";
import { canAccessIntelligence } from "@/lib/featureAccess";

export default async function LearnPage() {
  const canAccess = await canAccessIntelligence();
  redirect(canAccess ? "/intelligence" : "/markets");
}
