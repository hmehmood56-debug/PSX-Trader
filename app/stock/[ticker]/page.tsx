import { notFound } from "next/navigation";
import { getStockByTicker } from "@/lib/mockData";
import { StockDetailClient } from "./StockDetailClient";

type PageProps = { params: { ticker: string } };

export default function StockPage({ params }: PageProps) {
  const ticker = params.ticker.toUpperCase();
  const stock = getStockByTicker(ticker);
  if (!stock) notFound();
  return <StockDetailClient stock={stock} />;
}
