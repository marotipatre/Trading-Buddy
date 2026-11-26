"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, LineSeries, LineStyle, PriceScaleMode, createChart, createSeriesMarkers,
  type IChartApi, type IPriceLine, type ISeriesApi, type ISeriesMarkersPluginApi, type SeriesMarker, type Time, type UTCTimestamp,
} from "lightweight-charts";
import { toChartTime } from "@/lib/chart-ranges";
import type { Drawing } from "@/lib/drawings";
import { DrawingLayer, type Tool } from "./drawing-layer";
import type { Candle } from "@/lib/data/types";

export interface ChartLine { price: number; label: string; tone: "primary" | "up" | "down" | "muted"; dashed?: boolean }
export interface ChartMarker { time: number; position: "aboveBar" | "belowBar"; shape: "arrowUp" | "arrowDown" | "circle"; tone: "up" | "down" | "primary"; text: string }
export interface Hover { time: number; open: number; high: number; low: number; close: number; volume?: number }

// The chart library cannot parse the app's oklch theme colours, so it gets explicit values per theme.
const PALETTE = {
  light: { text: "#5b6472", grid: "rgba(15,23,42,0.06)", up: "#0f9d73", down: "#e5484d", primary: "#0f9d73", muted: "#8b94a3", volUp: "rgba(15,157,115,0.28)", volDown: "rgba(229,72,77,0.28)" },
  dark: { text: "#9aa3b2", grid: "rgba(255,255,255,0.07)", up: "#3ecf8e", down: "#f2555a", primary: "#3ecf8e", muted: "#7b8494", volUp: "rgba(62,207,142,0.28)", volDown: "rgba(242,85,90,0.28)" },
} as const;

export type ScaleMode = "price" | "percent" | "log";
const SCALE: Record<ScaleMode, PriceScaleMode> = { price: PriceScaleMode.Normal, percent: PriceScaleMode.Percentage, log: PriceScaleMode.Logarithmic };

export function PriceChart({ candles, intraday, mode, dark, lines, markers, resetKey, onHover, scale, tool, onToolChange, drawings, onDrawingsChange }: {
  candles: Candle[];
  intraday: boolean;
  mode: "candles" | "line";
  dark: boolean;
  lines: ChartLine[];
  markers: ChartMarker[];
  /** Changes when the symbol or timeframe changes, so the view refits; live updates keep your zoom. */
  resetKey: string;
  onHover?: (h: Hover | null) => void;
  /** Price scale: actual price, percentage change from the first visible bar, or logarithmic. */
  scale: ScaleMode;
  tool: Tool;
  onToolChange: (t: Tool) => void;
  drawings: Drawing[];
  onDrawingsChange: (d: Drawing[]) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainRef = useRef<ISeriesApi<"Candlestick" | "Line"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markerApi = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const lineRefs = useRef<IPriceLine[]>([]);
  const fitted = useRef("");
  const [version, setVersion] = useState(0);
  const [handles, setHandles] = useState<{ chart: IChartApi; main: ISeriesApi<"Candlestick" | "Line"> } | null>(null);
  const pal = dark ? PALETTE.dark : PALETTE.light;

  // 1. Build the chart (again if the style changes).
  useEffect(() => {
    if (!box.current) return;
    const chart = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: pal.text, fontFamily: "inherit" },
      grid: { vertLines: { color: pal.grid }, horzLines: { color: pal.grid } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: intraday, secondsVisible: false, rightOffset: 4 },
      crosshair: { mode: CrosshairMode.Normal },
    });
    const main = mode === "candles"
      ? chart.addSeries(CandlestickSeries, { upColor: pal.up, downColor: pal.down, wickUpColor: pal.up, wickDownColor: pal.down, borderVisible: false })
      : chart.addSeries(LineSeries, { color: pal.primary, lineWidth: 2, priceLineVisible: true });
    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "" });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    markerApi.current = createSeriesMarkers(main, []);
    chart.subscribeCrosshairMove((p) => {
      const d = p.seriesData.get(main) as { open?: number; high?: number; low?: number; close?: number; value?: number } | undefined;
      if (!p.time || !d) return onHover?.(null);
      const v = p.seriesData.get(vol) as { value?: number } | undefined;
      const close = d.close ?? d.value ?? 0;
      onHover?.({ time: Number(p.time), open: d.open ?? close, high: d.high ?? close, low: d.low ?? close, close, volume: v?.value });
    });
    chartRef.current = chart; mainRef.current = main; volRef.current = vol; lineRefs.current = []; fitted.current = "";
    setVersion((v) => v + 1);
    setHandles({ chart, main });
    return () => {
      setHandles(null); chart.remove(); chartRef.current = null; mainRef.current = null; volRef.current = null; markerApi.current = null; lineRefs.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pal is derived from `dark`; onHover is stable enough
  }, [mode, dark, intraday]);

  // 2. Data. Refit only when the symbol/timeframe changed, not on a live refresh.
  useEffect(() => {
    const main = mainRef.current, vol = volRef.current, chart = chartRef.current;
    if (!main || !vol || !chart) return;
    const t = (s: number) => toChartTime(s, intraday) as UTCTimestamp;
    main.setData(mode === "candles"
      ? candles.map((c) => ({ time: t(c.time), open: c.open, high: c.high, low: c.low, close: c.close }))
      : candles.map((c) => ({ time: t(c.time), value: c.close })));
    vol.setData(candles.map((c) => ({ time: t(c.time), value: c.volume, color: c.close >= c.open ? pal.volUp : pal.volDown })));
    chart.priceScale("right").applyOptions({ mode: SCALE[scale] });
    if (candles.length && fitted.current !== resetKey) { chart.timeScale().fitContent(); fitted.current = resetKey; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, version, resetKey, intraday, mode, scale]);

  // 3. Overlays: your orders as price lines, your past trades as markers.
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    for (const l of lineRefs.current) main.removePriceLine(l);
    lineRefs.current = lines.map((l) => main.createPriceLine({
      price: l.price, color: pal[l.tone], lineWidth: 1, lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid, axisLabelVisible: true, title: l.label,
    }));
    const t = (s: number) => toChartTime(s, intraday) as UTCTimestamp;
    const ms: SeriesMarker<Time>[] = markers
      .map((m) => ({ time: t(m.time) as Time, position: m.position, shape: m.shape, color: pal[m.tone], text: m.text }))
      .sort((a, b) => Number(a.time) - Number(b.time));
    markerApi.current?.setMarkers(ms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, markers, version, candles]);

  return (
    <div className="relative h-[360px] w-full sm:h-[420px]">
      <div ref={box} className="absolute inset-0" />
      {handles && (
        <DrawingLayer chart={handles.chart} series={handles.main} candles={candles} drawings={drawings} onChange={onDrawingsChange}
          tool={tool} onToolChange={onToolChange} colors={{ up: pal.up, down: pal.down }} />
      )}
    </div>
  );
}
