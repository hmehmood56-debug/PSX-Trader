"use client";

import { hierarchy, treemap } from "d3-hierarchy";
import { useEffect, useMemo, useRef, useState } from "react";

export type HeatmapItem = {
  label: string;
  value: number;
  weight: number;
  direction: "positive" | "negative" | "neutral";
  isOther?: boolean;
};

type StyledHeatmapItem = HeatmapItem & {
  tileBackground: string;
};

type LayoutHeatmapItem = StyledHeatmapItem & {
  layoutWeight: number;
};

type HeatmapHierarchyRoot = {
  children: LayoutHeatmapItem[];
};

type HeatmapHierarchyDatum = HeatmapHierarchyRoot | LayoutHeatmapItem;

interface PerchHeatmapProps {
  items: HeatmapItem[];
  formatValue?: (value: number) => string;
  className?: string;
  rowHeight?: number;
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

const SHORT_LABELS: Record<string, string> = {
  "Oil and Gas Exploration Companies": "Oil & Gas Exp.",
  "Oil and Gas Marketing Companies": "Oil & Gas Mkt.",
  "Power Generation and Distribution": "Power Gen",
  "Food and Personal Care Products": "Food & Care",
};

export function PerchHeatmap({ items, formatValue = defaultFormatValue, className, rowHeight }: PerchHeatmapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateWidth = () => {
      setContainerWidth(node.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const heatmapItems = useMemo(() => {
    const entries = [...items];
    entries.sort((a, b) => b.weight - a.weight);
    const otherIndex = entries.findIndex((entry) => entry.isOther === true);
    if (otherIndex >= 0) {
      const [otherItem] = entries.splice(otherIndex, 1);
      entries.push(otherItem);
    }

    const maxAbsValue = Math.max(...entries.map((entry) => Math.abs(entry.value)), 1);
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

    const styledEntries = entries.map((entry) => {
      const magnitudeRatio = Math.min(1, Math.abs(entry.value) / maxAbsValue);
      const intensity = 0.6 + magnitudeRatio * 0.25;

      const greenPalette = { dark: "#0F4F3C", base: "#1B7F5C", light: "#2FA97C" };
      const redPalette = { dark: "#7F0F17", base: "#C1121F", light: "#E63946" };
      const palette = entry.direction === "positive" ? greenPalette : entry.direction === "negative" ? redPalette : greenPalette;
      const shiftedDark = blendHex(palette.light, palette.dark, intensity);
      const shiftedBase = blendHex(palette.light, palette.base, intensity);
      const shiftedLight = blendHex(shiftedBase, palette.light, 0.14);
      const mutedIntensity = 0.4 + magnitudeRatio * 0.14;
      const mutedDark = blendHex(palette.light, palette.dark, mutedIntensity);
      const mutedBase = blendHex(palette.light, palette.base, mutedIntensity);
      const mutedLight = blendHex(mutedBase, palette.light, 0.18);

      const tileSurface = entry.isOther
        ? `linear-gradient(135deg, ${mutedDark} 0%, ${mutedBase} 65%, ${mutedLight} 100%)`
        : `linear-gradient(135deg, ${shiftedDark} 0%, ${shiftedBase} 65%, ${shiftedLight} 100%)`;

      return {
        ...entry,
        tileBackground: tileSurface,
      };
    });

    const height = Math.max(300, Math.min(420, (rowHeight ?? 54) * 6));
    const width = Math.max(1, containerWidth - 4);
    const maxNonOtherWeight = styledEntries.reduce((max, entry) => {
      if (entry.isOther) return max;
      return Math.max(max, Math.max(0, entry.weight));
    }, 0);
    const weightCompressionExponent = 0.82;
    const otherLayoutWeightCap = maxNonOtherWeight > 0 ? maxNonOtherWeight * 0.22 : 0;
    const otherLayoutWeightFloor = maxNonOtherWeight > 0 ? maxNonOtherWeight * 0.08 : 0;
    const nonOtherLayoutWeightFloor = maxNonOtherWeight > 0 ? maxNonOtherWeight * 0.05 : 0;

    const root = hierarchy<HeatmapHierarchyDatum>(
      {
      children: (() => {
        const baseLayoutEntries = styledEntries.map((entry) => {
          let layoutWeight = Math.max(0, entry.weight);
          if (maxNonOtherWeight > 0 && layoutWeight > 0) {
            // Compress dynamic range so smaller sectors remain visible while
            // preserving ordering and relative meaning.
            const normalizedWeight = layoutWeight / maxNonOtherWeight;
            layoutWeight = maxNonOtherWeight * Math.pow(normalizedWeight, weightCompressionExponent);
          }
          if (entry.isOther && otherLayoutWeightCap > 0) {
            layoutWeight = Math.min(layoutWeight, otherLayoutWeightCap);
            layoutWeight = Math.max(layoutWeight, otherLayoutWeightFloor);
          } else if (!entry.isOther && nonOtherLayoutWeightFloor > 0) {
            layoutWeight = Math.max(layoutWeight, nonOtherLayoutWeightFloor);
          }
          return {
            ...entry,
            layoutWeight: layoutWeight > 0 ? layoutWeight : 0.000001,
          };
        });

        const totalLayoutWeight = baseLayoutEntries.reduce(
          (sum, entry) => sum + entry.layoutWeight,
          0
        );
        const minNonOtherLayoutShare = 0.03;
        const minNonOtherLayoutWeight =
          totalLayoutWeight > 0 ? totalLayoutWeight * minNonOtherLayoutShare : 0;

        return baseLayoutEntries.map((entry) => {
          if (entry.isOther) return entry;
          return {
            ...entry,
            layoutWeight: Math.max(entry.layoutWeight, minNonOtherLayoutWeight),
          };
        });
      })(),
      },
      (datum) => ("children" in datum ? datum.children : undefined)
    )
      .sum((datum) => {
        if (!("layoutWeight" in datum)) return 0;
        return datum.layoutWeight > 0 ? datum.layoutWeight : 0.000001;
      })
      .sort((a, b) => {
        const aOther = a.data?.isOther === true;
        const bOther = b.data?.isOther === true;
        if (aOther && !bOther) return 1;
        if (!aOther && bOther) return -1;
        return (b.value ?? 0) - (a.value ?? 0);
      });

    treemap<HeatmapHierarchyDatum>()
      .size([width, height])
      .paddingInner(2)
      .paddingOuter(1)
      .round(true)(root);

    const computedTiles = root.leaves().map((leaf) => {
      const left = Math.round(leaf.x0);
      const top = Math.round(leaf.y0);
      const right = Math.round(leaf.x1);
      const bottom = Math.round(leaf.y1);
      const tileWidth = Math.max(0, right - left) + 0.5;
      const tileHeight = Math.max(0, bottom - top) + 0.5;
      const tileArea = tileWidth * tileHeight;
      const areaRatio = tileArea / Math.max(1, width * height);
      const bucket = areaRatio >= 0.16 ? "large" : areaRatio >= 0.07 ? "medium" : "small";
      const canShowLabel = tileWidth >= 52 && tileHeight >= 24;
      const canShowValue = tileWidth >= 52 && tileHeight >= 26;
      return {
        ...leaf.data,
        x: left,
        y: top,
        width: tileWidth,
        height: tileHeight,
        bucket,
        canShowLabel,
        canShowValue,
        displayLabel: SHORT_LABELS[leaf.data.label] ?? leaf.data.label,
      };
    });

    return computedTiles;
  }, [containerWidth, items, rowHeight]);

  const treemapHeight = Math.max(300, Math.min(420, (rowHeight ?? 54) * 6));

  return (
    <div
      className={`rounded-lg overflow-hidden${className ? ` ${className}` : ""}`}
      style={{
        background: "#fbfaf8",
        padding: 2,
      }}
    >
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          height: treemapHeight,
          overflow: "hidden",
        }}
      >
        {heatmapItems.map((row) => {
          const valueSize = row.bucket === "large" ? 26 : row.bucket === "medium" ? 18 : 13;
          return (
            <div
              key={`${row.label}-heatmap`}
              title={`${row.label}: ${formatValue(row.value)}`}
              style={{
                position: "absolute",
                left: row.x,
                top: row.y,
                width: row.width,
                height: row.height,
                background: row.tileBackground,
                minWidth: 0,
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
              {row.canShowLabel ? (
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
                  {row.displayLabel}
                </span>
              ) : null}
              {row.canShowValue ? (
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
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
