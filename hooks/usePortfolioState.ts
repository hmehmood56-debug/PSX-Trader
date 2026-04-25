"use client";

import { usePortfolio } from "@/components/PortfolioProvider";
import type { Portfolio } from "@/lib/portfolioTypes";

export function usePortfolioState(): Portfolio {
  return usePortfolio().portfolio;
}

export { usePortfolio } from "@/components/PortfolioProvider";
