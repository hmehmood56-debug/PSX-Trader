"use client";

import { createElement, type ReactNode } from "react";
import { PriceSimulatorProvider } from "@/lib/priceSimulator";

export function Providers({ children }: { children: ReactNode }) {
  return createElement(PriceSimulatorProvider, null, children);
}
