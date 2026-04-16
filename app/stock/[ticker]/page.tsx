import { getStockByTicker } from "@/lib/mockData";
import { StockDetailClient } from "./StockDetailClient";

type PageProps = { params: { ticker: string } };

export default function StockPage({ params }: PageProps) {
  const ticker = params.ticker.toUpperCase();
  const stock =
    getStockByTicker(ticker) ?? {
      ticker,
      name: `${ticker} (PSX)`,
      sector: "PSX Listed",
      marketCap: 0,
      high52: 0,
      low52: 0,
      description: "Live PSX listed ticker.",
      price: 0,
      change: 0,
      changePercent: 0,
      volume: 0,
    };
  return <StockDetailClient stock={stock} />;
}
