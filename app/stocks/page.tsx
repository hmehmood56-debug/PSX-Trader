"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { getAllSectors } from "@/lib/mockData";
import { useLivePrices } from "@/lib/priceSimulator";
import { formatCompactPKR, formatPKRWithSymbol } from "@/lib/format";

const COLORS = {
  orange: "#C45000",
  bg: "#FFFFFF",
  bgSecondary: "#F7F7F7",
  border: "#E8E8E8",
  text: "#1A1A1A",
  muted: "#6B6B6B",
  gain: "#007A4C",
  loss: "#C0392B",
} as const;

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
    <div style={{ background: COLORS.bg }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 32 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: COLORS.muted,
                fontWeight: 600,
              }}
            >
              Search
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ticker or company name"
              style={{
                marginTop: 8,
                width: "100%",
                height: 40,
                borderRadius: 8,
                border: `1px solid ${COLORS.border}`,
                padding: "0 12px",
                fontSize: 14,
                outline: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = COLORS.orange;
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(196,80,0,0.18)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = COLORS.border;
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <div style={{ width: 240 }}>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: COLORS.muted,
                fontWeight: 600,
              }}
            >
              Sector
            </div>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              style={{
                marginTop: 8,
                width: "100%",
                height: 40,
                borderRadius: 8,
                border: `1px solid ${COLORS.border}`,
                padding: "0 12px",
                fontSize: 14,
                outline: "none",
                background: "#FFFFFF",
              }}
            >
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            background: "#FFFFFF",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: COLORS.bgSecondary }}>
                {[
                  "Ticker",
                  "Company",
                  "Price",
                  "Change",
                  "Change %",
                  "Volume",
                  "Mkt Cap",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === "Company" || h === "Ticker" ? "left" : "right",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: COLORS.muted,
                      fontWeight: 600,
                      padding: "12px 16px",
                      borderBottom: `1px solid ${COLORS.border}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
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
                    style={{ height: 48, cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        COLORS.bgSecondary;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        "#FFFFFF";
                    }}
                  >
                    <td
                      style={{
                        padding: "0 16px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        color: COLORS.orange,
                        fontWeight: 700,
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      }}
                    >
                      {s.ticker}
                    </td>
                    <td
                      style={{
                        padding: "0 16px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        color: COLORS.muted,
                        maxWidth: 420,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.name}
                    </td>
                    <td
                      style={{
                        padding: "0 16px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        textAlign: "right",
                        color: COLORS.text,
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatPKRWithSymbol(s.price)}
                    </td>
                    <td
                      style={{
                        padding: "0 16px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        textAlign: "right",
                        color: up ? COLORS.gain : COLORS.loss,
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {up ? "+" : ""}
                      {s.change.toFixed(2)}
                    </td>
                    <td
                      style={{
                        padding: "0 16px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        textAlign: "right",
                        color: up ? COLORS.gain : COLORS.loss,
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {up ? "+" : ""}
                      {s.changePercent.toFixed(2)}%
                    </td>
                    <td
                      style={{
                        padding: "0 16px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        textAlign: "right",
                        color: COLORS.muted,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatCompactPKR(s.volume)}
                    </td>
                    <td
                      style={{
                        padding: "0 16px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        textAlign: "right",
                        color: COLORS.muted,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatCompactPKR(s.marketCap)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: COLORS.muted }}>
              No matches.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
