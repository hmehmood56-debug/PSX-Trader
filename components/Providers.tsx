"use client";

import { AuthProvider } from "@/components/auth/AuthProvider";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";
import { NavigationProgress } from "@/components/NavigationProgress";
import { PortfolioProvider } from "@/components/PortfolioProvider";
import { PriceSimulatorProvider } from "@/lib/priceSimulator";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PriceSimulatorProvider>
        <PostHogProvider>
          <PortfolioProvider>
            <NavigationProgress />
            {children}
          </PortfolioProvider>
        </PostHogProvider>
      </PriceSimulatorProvider>
    </AuthProvider>
  );
}
