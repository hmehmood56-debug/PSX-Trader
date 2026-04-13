"use client";

import { getPortfolio, type Portfolio } from "@/lib/portfolioStore";
import { useCallback, useEffect, useState } from "react";

export function usePortfolioState(): Portfolio {
  const [p, setP] = useState<Portfolio>(() =>
    typeof window === "undefined"
      ? { cash: 1_000_000, holdings: [] }
      : getPortfolio()
  );

  const refresh = useCallback(() => {
    setP(getPortfolio());
  }, []);

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener("psx-portfolio-updated", onUpdate);
    return () => window.removeEventListener("psx-portfolio-updated", onUpdate);
  }, [refresh]);

  return p;
}
