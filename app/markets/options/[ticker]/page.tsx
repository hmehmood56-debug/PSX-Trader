import { notFound } from "next/navigation";
import { OptionsSimulatorClient } from "@/components/markets/OptionsSimulatorClient";

function isValidTicker(raw: string): boolean {
  return /^[A-Za-z][A-Za-z0-9-]{0,19}$/.test(raw);
}

export default function OptionsTickerPage({ params }: { params: { ticker: string } }) {
  const raw = params.ticker ?? "";
  if (!isValidTicker(raw)) {
    notFound();
  }
  return <OptionsSimulatorClient ticker={decodeURIComponent(raw)} />;
}
