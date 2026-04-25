"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { StockChartPoint, StockDetailChartRange } from "@/app/stock/[ticker]/StockPriceLwcChart";

const GRID = "#F2F0EE";
const AXIS = "#6B6B6B";
const CROSS = "rgba(0,0,0,0.1)";
const SCALE_BORDER = "#E8E4DF";

type Props = {
  data: StockChartPoint[];
  range: StockDetailChartRange;
  lineColor: string;
  lineColorFaint: string;
};

function toChartTime(iso: string): UTCTimestamp {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return Math.floor(Date.now() / 1000) as UTCTimestamp;
  }
  return Math.floor(d.getTime() / 1000) as UTCTimestamp;
}

export function DashboardPortfolioChart({ data, range, lineColor, lineColorFaint }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area", Time> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const processedData = useMemo(() => {
    let next = [...data]
      .map((p) => ({ time: new Date(p.date).getTime(), value: p.price }))
      .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
      .sort((a, b) => a.time - b.time);

    const uniqueMsMap = new Map<number, { time: number; value: number }>();
    for (const p of next) {
      uniqueMsMap.set(p.time, p);
    }
    next = Array.from(uniqueMsMap.values());

    next = next.map((p) => ({
      ...p,
      time: Math.floor(p.time / 1000),
    }));

    const uniqueSecMap = new Map<number, { time: number; value: number }>();
    for (const p of next) {
      uniqueSecMap.set(p.time, p);
    }

    return Array.from(uniqueSecMap.values())
      .filter((p) => p && Number.isFinite(p.time) && p.value !== undefined)
      .sort((a, b) => a.time - b.time)
      .map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));
  }, [data, range]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const { width, height } = host.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;

    const chart = createChart(host, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "rgba(0,0,0,0)" },
        textColor: AXIS,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        fontSize: 11,
      },
      rightPriceScale: {
        borderVisible: true,
        borderColor: SCALE_BORDER,
        minimumWidth: 72,
        autoScale: true,
      },
      timeScale: {
        borderColor: SCALE_BORDER,
        timeVisible: range === "1D",
        secondsVisible: false,
        rightOffset: 0,
        fixLeftEdge: true,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: true,
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: false,
        horzTouchDrag: false,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: false,
        mouseWheel: false,
        pinch: false,
      },
      grid: {
        vertLines: { color: GRID, visible: false, style: 0 },
        horzLines: { color: GRID, visible: true, style: 0 },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: CROSS, width: 1, labelVisible: true },
        horzLine: { color: CROSS, width: 1, labelVisible: true },
      },
    });

    const series = chart.addAreaSeries({
      lineColor,
      lineWidth: 3,
      topColor: lineColorFaint,
      bottomColor: "rgba(88, 82, 76, 0.02)",
      priceLineVisible: true,
      lastValueVisible: true,
    });
    series.priceScale().applyOptions({
      borderVisible: true,
      borderColor: SCALE_BORDER,
      scaleMargins: { top: 0.06, bottom: 0.08 },
    });

    chartRef.current = chart;
    seriesRef.current = series;
    // Debug safeguard: chart should initialize once per mount.
    console.debug("[DashboardPortfolioChart] created");

    const ro = new ResizeObserver(() => {
      if (!hostRef.current || !chartRef.current) return;
      const rect = hostRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        chartRef.current.applyOptions({ width: rect.width, height: rect.height });
      }
    });
    ro.observe(host);
    resizeObserverRef.current = ro;

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
      // Debug safeguard: should fire only on unmount.
      console.debug("[DashboardPortfolioChart] removed");
    };
    // Intentionally empty to prevent re-initialization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    if (processedData.length < 2) return;
    console.log("CHART DATA:", processedData);
    seriesRef.current.setData(processedData);
    chartRef.current.timeScale().fitContent();
    console.debug("[DashboardPortfolioChart] data set", processedData.length);
  }, [processedData]);

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;
    chartRef.current.applyOptions({
      timeScale: { timeVisible: range === "1D", secondsVisible: false },
    });
    seriesRef.current.applyOptions({
      lineColor,
      topColor: lineColorFaint,
    });
  }, [range, lineColor, lineColorFaint]);

  return (
    <div
      className="perch-stock-lwc-host"
      ref={hostRef}
      role="img"
      aria-label="Portfolio value chart"
    />
  );
}
