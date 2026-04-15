"use client";

import { AuthProvider } from "@/components/auth/AuthProvider";
import { NavigationProgress } from "@/components/NavigationProgress";
import { PortfolioProvider } from "@/components/PortfolioProvider";
import { PriceSimulatorProvider } from "@/lib/priceSimulator";
import { Fragment, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PriceSimulatorProvider>
      <AuthProvider>
        <PortfolioProvider>
          <NavigationProgress />
          {children}
        </PortfolioProvider>
      </AuthProvider>
    </PriceSimulatorProvider>
  );
}
