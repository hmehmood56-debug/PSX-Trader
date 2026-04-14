"use client";

import { createElement, Fragment, type ReactNode } from "react";
import { NavigationProgress } from "@/components/NavigationProgress";
import { PriceSimulatorProvider } from "@/lib/priceSimulator";

export function Providers({ children }: { children: ReactNode }) {
  return createElement(
    PriceSimulatorProvider,
    null,
    createElement(Fragment, null, createElement(NavigationProgress, null), children)
  );
}
