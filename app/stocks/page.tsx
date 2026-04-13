"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { getAllSectors } from "@/lib/mockData";
import { useLivePrices } from "@/lib/priceSimulator";
import { formatCompactPKR, formatPKRWithSymbol } from "@/lib/format";

export default function StocksPage() {
  const router = useRouter();
  const { getStocksWithLive } = useLivePrices();
  const stocks = getStocksWithLive();
  const sectors = useMemo(() => ["All", ...getAllSectors()], []);

  const [q, setQ] = useState("");
  const [sector, setSector] = useState("All");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return stocks.filter((s) => {
      const secOk = sector === "All" || s.sector === sector;
      const textOk =
        !term ||
        s.ticker.toLowerCase().includes(term) ||
        s.name.toLowerCase().includes(term);
      return secOk && textOk;
    });
  }, [stocks, q, sector]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-fintech-muted">
        Live quotes (simulated). Select a row for details.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">
            Search
          </label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ticker or company name"
            className="mt-2 w-full rounded-lg border border-fintech-border bg-white px-3 py-2 text-sm text-fintech-text outline-none ring-0 focus:border-fintech-brand focus:ring-2 focus:ring-fintech-brand/25"
          />
        </div>
        <div className="sm:w-56">
          <label className="text-xs font-semibold uppercase tracking-wide text-fintech-muted">
            Sector
          </label>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="mt-2 w-full rounded-lg border border-fintech-border bg-white px-3 py-2 text-sm text-fintech-text outline-none focus:border-fintech-brand focus:ring-2 focus:ring-fintech-brand/25"
          >
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-fintech-border bg-white shadow-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-fintech-border bg-fintech-card">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                Ticker
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                Company
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                Change
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                Change %
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                Volume
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-fintech-muted">
                Mkt Cap
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const up = s.change >= 0;
              return (
                <tr
                  key={s.ticker}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`/stock/${s.ticker}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/stock/${s.ticker}`);
                    }
                  }}
                  className="cursor-pointer border-b border-fintech-border last:border-b-0 hover:bg-fintech-card"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-fintech-brand">
                      {s.ticker}
                    </span>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-fintech-muted">
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold tabular-nums text-fintech-text">
                    {formatPKRWithSymbol(s.price)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums ${
                      up ? "text-fintech-gain" : "text-fintech-loss"
                    }`}
                  >
                    {up ? "+" : ""}
                    {s.change.toFixed(2)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums ${
                      up ? "text-fintech-gain" : "text-fintech-loss"
                    }`}
                  >
                    {up ? "+" : ""}
                    {s.changePercent.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right text-fintech-muted tabular-nums">
                    {formatCompactPKR(s.volume)}
                  </td>
                  <td className="px-4 py-3 text-right text-fintech-muted tabular-nums">
                    {formatCompactPKR(s.marketCap)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-fintech-muted">
            No matches.
          </p>
        )}
      </div>
    </div>
  );
}
