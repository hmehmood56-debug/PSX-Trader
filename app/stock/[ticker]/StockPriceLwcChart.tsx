"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

export type StockDetailChartRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

export type StockChartPoint = { date: string; price: number; volume: number };

const GRID = "#F2F0EE";
const AXIS = "#6B6B6B";
const CROSS = "rgba(0,0,0,0.1)";
const SCALE_BORDER = "#E8E4DF";
const VOL_NEUTRAL = "rgba(105, 103, 99, 0.14)";
const VOL_UP = "rgba(0, 122, 76, 0.16)";
const VOL_DOWN = "rgba(192, 57, 43, 0.16)";

function sortPointsAsc(points: StockChartPoint[]): StockChartPoint[] {
  return [...points].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function toChartTime(iso: string, range: StockDetailChartRange): Time {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return Math.floor(Date.now() / 1000) as UTCTimestamp;
  }
  if (range === "1D") {
    return Math.floor(d.getTime() / 1000) as UTCTimestamp;
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type CollapsedPoint = { time: Time; price: number; volume: number };

function collapseSeries(
  sorted: StockChartPoint[],
  range: StockDetailChartRange
): { line: { time: Time; value: number }[]; volume: { time: Time; value: number; color: string }[] } {
  const map = new Map<string | number, CollapsedPoint>();
  for (const p of sorted) {
    if (!Number.isFinite(p.price)) continue;
    const t = toChartTime(p.date, range);
    const key: string | number = typeof t === "number" ? t : String(t);
    const vol = Number.isFinite(p.volume) && p.volume > 0 ? p.volume : 0;
    map.set(key, { time: t, price: p.price, volume: vol });
  }
  const collapsed = Array.from(map.values()).sort((a, b) => {
    const ta = a.time;
    const tb = b.time;
    if (typeof ta === "number" && typeof tb === "number") return ta - tb;
    return String(ta).localeCompare(String(tb));
  });

  const vol = collapsed
    .filter((c) => c.volume > 0)
    .map((c, i, arr) => {
      if (i === 0) {
        return { time: c.time, value: c.volume, color: VOL_NEUTRAL };
      }
      const prev = arr[i - 1].price;
      const up = c.price >= prev;
      return { time: c.time, value: c.volume, color: up ? VOL_UP : VOL_DOWN };
    });

  let line = collapsed.map((c) => ({ time: c.time, value: c.price }));
  if (line.length === 1) {
    const one = line[0];
    if (typeof one.time === "number") {
      line = [
        { time: (one.time - 60) as UTCTimestamp, value: one.value },
        { time: one.time, value: one.value },
      ];
    } else if (typeof one.time === "string") {
      const d = new Date(`${one.time}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      line = [
        { time: `${y}-${m}-${day}`, value: one.value },
        { time: one.time, value: one.value },
      ];
    }
  }
  return { line, volume: vol };
}

type Props = {
  data: StockChartPoint[];
  range: StockDetailChartRange;
  lineColor: string;
  lineColorFaint: string;
  showVolume?: boolean;
  minimalGrid?: boolean;
  priceScaleMargins?: { top: number; bottom: number };
};

export function StockPriceLwcChart({
  data,
  range,
  lineColor,
  lineColorFaint,
  showVolume = true,
  minimalGrid = false,
  priceScaleMargins,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const areaRef = useRef<ISeriesApi<"Area", Time> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram", Time> | null>(null);
  const lineColorRef = useRef(lineColor);
  lineColorRef.current = lineColor;
  const lineColorFaintRef = useRef(lineColorFaint);
  lineColorFaintRef.current = lineColorFaint;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "rgba(0,0,0,0)" },
        textColor: AXIS,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        fontSize: 11,
      },
      watermark: { visible: false },
      rightPriceScale: {
        borderVisible: true,
        borderColor: SCALE_BORDER,
        entireTextOnly: true,
        minimumWidth: 64,
        ticksVisible: true,
        autoScale: true,
      },
      timeScale: {
        borderColor: SCALE_BORDER,
        timeVisible: range === "1D",
        secondsVisible: range === "1D",
        rightOffset: 0,
        barSpacing: range === "1D" ? 0.5 : 5,
        rightBarStaysOnScroll: true,
        fixLeftEdge: true,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: true,
        minBarSpacing: 0.2,
        tickMarkFormatter: (t: Time) => {
          if (typeof t === "number") {
            return new Date(t * 1000).toLocaleTimeString("en-PK", {
              hour: "numeric",
              minute: "2-digit",
            });
          }
          if (typeof t === "string") {
            return new Date(`${t}T12:00:00Z`).toLocaleDateString("en-PK", {
              month: "short",
              day: "numeric",
            });
          }
          if (t && typeof t === "object" && "day" in t) {
            const b = t as { year: number; month: number; day: number };
            return new Date(b.year, b.month - 1, b.day).toLocaleDateString("en-PK", {
              month: "short",
              day: "numeric",
            });
          }
          return "";
        },
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
        vertLines: { color: GRID, style: 0, visible: !minimalGrid },
        horzLines: { color: GRID, style: 0, visible: true },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: CROSS, width: 1, labelVisible: true },
        horzLine: { color: CROSS, width: 1, labelVisible: true },
      },
    });

    const area = chart.addAreaSeries({
      lineColor,
      lineWidth: 3,
      topColor: lineColorFaint,
      bottomColor: "rgba(88, 82, 76, 0.02)",
      priceLineVisible: true,
      lastValueVisible: true,
    });
    area.priceScale().applyOptions({
      borderVisible: true,
      borderColor: SCALE_BORDER,
      scaleMargins: priceScaleMargins ?? { top: 0.08, bottom: showVolume ? 0.2 : 0.08 },
    });

    let vol: ISeriesApi<"Histogram", Time> | null = null;
    if (showVolume) {
      vol = chart.addHistogramSeries({
        color: VOL_NEUTRAL,
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
        base: 0,
      });
      vol.priceScale().applyOptions({
        scaleMargins: { top: 0.72, bottom: 0 },
        borderVisible: false,
        visible: false,
      });
    }

    chartRef.current = chart;
    areaRef.current = area;
    volRef.current = vol;

    const ro = new ResizeObserver(() => {
      if (!hostRef.current || !chartRef.current) return;
      const { width, height } = hostRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) {
        chartRef.current.applyOptions({ width, height });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      areaRef.current = null;
      volRef.current = null;
    };
  }, [range, showVolume, minimalGrid, priceScaleMargins, lineColor, lineColorFaint]);

  useEffect(() => {
    if (!areaRef.current || !chartRef.current) return;
    const sorted = sortPointsAsc(data);
    const { line, volume } = collapseSeries(sorted, range);
    areaRef.current.setData(line);
    areaRef.current.applyOptions({
      lineColor: lineColorRef.current,
      topColor: lineColorFaintRef.current,
    });

    if (volRef.current) {
      volRef.current.setData(volume);
    }

    if (line.length) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data, range, lineColor, lineColorFaint]);

  return <div className="perch-stock-lwc-host" ref={hostRef} role="img" aria-label="Price chart" />;
}
