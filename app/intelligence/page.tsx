import { IntelligenceSurface } from "@/components/intelligence/IntelligenceSurface";
import { redirect } from "next/navigation";
import { canAccessIntelligence } from "@/lib/featureAccess";

export default async function IntelligencePage() {
  const canAccess = await canAccessIntelligence();
  if (!canAccess) {
    redirect("/markets");
  }

  return (
    <div className="intelligence-page-bg">
      <IntelligenceSurface />
    </div>
  );
}
