import { getStockByTicker } from "@/lib/mockData";
import { inferPsxListingSector } from "@/lib/psxSectorInference";
import { StockDetailClient } from "./StockDetailClient";

type PageProps = { params: { ticker: string } };

export default function StockPage({ params }: PageProps) {
  const ticker = params.ticker.toUpperCase();
  const sector = inferPsxListingSector(ticker);
  const stock =
    getStockByTicker(ticker) ?? {
      ticker,
      name: `${ticker} (PSX)`,
      sector,
      marketCap: 0,
      high52: 0,
      low52: 0,
      description: `KSE-listed equity — ${sector}.`,
      price: 0,
      change: 0,
      changePercent: 0,
      volume: 0,
    };
  return <StockDetailClient stock={stock} />;
}
