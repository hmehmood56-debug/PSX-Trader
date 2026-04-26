"use client";

import { useMemo } from "react";

export type HeatmapItem = {
  label: string;
  value: number;
  weight: number;
  direction: "positive" | "negative" | "neutral";
  isOther?: boolean;
};

interface PerchHeatmapProps {
  items: HeatmapItem[];
  formatValue?: (value: number) => string;
  className?: string;
}

const defaultFormatValue = (value: number) => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) {
    return `${sign}Rs ${(abs / 1_000_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}Rs ${(abs / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
  }
  if (abs >= 1_000) {
    return `${sign}Rs ${(abs / 1_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`;
  }
  return `${sign}Rs ${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
};

export function PerchHeatmap({ items, formatValue = defaultFormatValue, className }: PerchHeatmapProps) {
  const heatmapItems = useMemo(() => {
    const entries = [...items];
    entries.sort((a, b) => b.weight - a.weight);
    const otherIndex = entries.findIndex((entry) => entry.isOther === true);
    if (otherIndex >= 0) {
      const [otherItem] = entries.splice(otherIndex, 1);
      entries.push(otherItem);
    }

    const maxAbsValue = Math.max(...entries.map((entry) => Math.abs(entry.value)), 1);
    const total = entries.length;
    const largeCount = Math.max(1, Math.ceil(total * 0.2));
    const mediumCount = Math.ceil(total * 0.4);

    return entries.map((entry, index) => {
      const magnitudeRatio = Math.min(1, Math.abs(entry.value) / maxAbsValue);
      const intensity = 0.6 + magnitudeRatio * 0.25;
      const blendHex = (from: string, to: string, amount: number) => {
        const parseHex = (hex: string) => {
          const clean = hex.replace("#", "");
          return {
            r: parseInt(clean.slice(0, 2), 16),
            g: parseInt(clean.slice(2, 4), 16),
            b: parseInt(clean.slice(4, 6), 16),
          };
        };
        const a = parseHex(from);
        const b = parseHex(to);
        const mix = (x: number, y: number) => Math.round(x + (y - x) * amount);
        const toHex = (v: number) => v.toString(16).padStart(2, "0");
        return `#${toHex(mix(a.r, b.r))}${toHex(mix(a.g, b.g))}${toHex(mix(a.b, b.b))}`;
      };

      const greenPalette = { dark: "#0F4F3C", base: "#1B7F5C", light: "#2FA97C" };
      const redPalette = { dark: "#7F0F17", base: "#C1121F", light: "#E63946" };
      const palette = entry.direction === "positive" ? greenPalette : entry.direction === "negative" ? redPalette : greenPalette;
      const shiftedDark = blendHex(palette.light, palette.dark, intensity);
      const shiftedBase = blendHex(palette.light, palette.base, intensity);
      const shiftedLight = blendHex(shiftedBase, palette.light, 0.14);

      const tileSurface = entry.isOther
        ? `linear-gradient(135deg, ${blendHex("#8a8a8a", "#6f6f6f", intensity)} 0%, ${blendHex("#9a9a9a", "#7f7f7f", intensity)} 65%, ${blendHex(blendHex("#9a9a9a", "#7f7f7f", intensity), "#b1b1b1", 0.14)} 100%)`
        : `linear-gradient(135deg, ${shiftedDark} 0%, ${shiftedBase} 65%, ${shiftedLight} 100%)`;

      const bucket = index < largeCount ? "large" : index < largeCount + mediumCount ? "medium" : "small";
      const gridSpan =
        bucket === "large"
          ? { gridColumn: "span 3", gridRow: "span 3" }
          : bucket === "medium"
            ? { gridColumn: "span 2", gridRow: "span 2" }
            : { gridColumn: "span 1", gridRow: "span 1" };

      return {
        ...entry,
        bucket,
        gridSpan,
        tileBackground: tileSurface,
      };
    });
  }, [items]);

  return (
    <div
      className={`rounded-lg overflow-hidden${className ? ` ${className}` : ""}`}
      style={{
        background: "#fbfaf8",
        padding: 2,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gridAutoRows: "54px",
          gridAutoFlow: "dense",
          gap: 1,
        }}
      >
        {heatmapItems.map((row) => {
          const valueSize = row.bucket === "large" ? 26 : row.bucket === "medium" ? 18 : 13;
          return (
            <div
              key={`${row.label}-heatmap`}
              title={`${row.label}: ${formatValue(row.value)}`}
              style={{
                ...row.gridSpan,
                background: row.tileBackground,
                minWidth: 0,
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: row.bucket === "large" ? "14px 10px 10px" : "10px 8px 8px",
                overflow: "hidden",
                boxShadow: "inset 0 -6px 12px rgba(0,0,0,0.18)",
                textAlign: "center",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.035) 30%, rgba(255,255,255,0) 60%)",
                  pointerEvents: "none",
                }}
              />
              <span
                style={{
                  marginTop: row.bucket === "large" ? -2 : 0,
                  fontSize: row.bucket === "small" ? 9 : 10.5,
                  fontWeight: 660,
                  letterSpacing: "0.06em",
                  color: "#FFFFFF",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  lineHeight: 1.2,
                  width: "100%",
                  textAlign: "center",
                }}
              >
                {row.label}
              </span>
              <span
                style={{
                  marginTop: row.bucket === "large" ? 9 : row.bucket === "medium" ? 7 : 5,
                  fontSize: valueSize,
                  fontWeight: row.bucket === "large" ? 800 : 760,
                  color: "#FFFFFF",
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1.1,
                  textAlign: "center",
                  textShadow: "0 1px 1px rgba(0,0,0,0.16)",
                }}
              >
                {formatValue(row.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
