"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, Logical } from "lightweight-charts";
import { drawingPriceAt, formatSpan, logicalToTime, measure, newDrawingId, pctFrom, timeToLogical, type DrawPoint, type Drawing } from "@/lib/drawings";
import type { Candle } from "@/lib/data/types";

export type Tool = "cursor" | "hline" | "trend" | "measure";

const sign = (n: number) => (n >= 0 ? "+" : "−");
const pct = (n: number) => `${sign(n)}${Math.abs(n).toFixed(2)}%`;

interface Props {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick" | "Line">;
  candles: Candle[];
  drawings: Drawing[];
  onChange: (d: Drawing[]) => void;
  tool: Tool;
  onToolChange: (t: Tool) => void;
  colors: { up: string; down: string };
}

/** Lines, trendlines and a measure ruler drawn over the chart. Points are stored as real timestamps and prices. */
export function DrawingLayer({ chart, series, candles, drawings, onChange, tool, onToolChange, colors }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0, tick: 0 });
  const [pending, setPending] = useState<DrawPoint | null>(null);
  const [cursor, setCursor] = useState<DrawPoint | null>(null);
  const times = useMemo(() => candles.map((c) => c.time), [candles]);
  const lastClose = candles.at(-1)?.close ?? 0;
  /** Bar counts are only meaningful when both points lie inside the loaded candles; otherwise they are extrapolated. */
  const inData = (pts: DrawPoint[]) => times.length > 1 && pts.every((p) => p.time >= times[0] && p.time <= times[times.length - 1]);
  const lastIdx = candles.length - 1;

  const redraw = useCallback(() => {
    const el = svg.current;
    setSize((s) => ({ w: el?.clientWidth ?? s.w, h: el?.clientHeight ?? s.h, tick: s.tick + 1 }));
  }, []);

  useEffect(() => {
    const ts = chart.timeScale();
    ts.subscribeVisibleLogicalRangeChange(redraw);
    chart.subscribeCrosshairMove(redraw);
    const ro = new ResizeObserver(redraw);
    if (svg.current) ro.observe(svg.current);
    const iv = setInterval(redraw, 400); // price-scale drags and wheel zooms do not emit events
    redraw();
    return () => { ts.unsubscribeVisibleLogicalRangeChange(redraw); chart.unsubscribeCrosshairMove(redraw); ro.disconnect(); clearInterval(iv); };
  }, [chart, redraw]);

  // Escape cancels a drawing in progress.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setPending(null); setCursor(null); onToolChange("cursor"); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onToolChange]);

  useEffect(() => {
    if (tool === "cursor") { setPending(null); setCursor(null); } // eslint-disable-line react-hooks/set-state-in-effect -- leaving a tool abandons a half-drawn shape
  }, [tool]);

  const X = (t: number) => chart.timeScale().logicalToCoordinate(timeToLogical(times, t) as Logical);
  const Y = (p: number) => series.priceToCoordinate(p);
  const xy = (p: DrawPoint): { x: number; y: number } | null => { const x = X(p.time), y = Y(p.price); return x === null || y === null ? null : { x, y }; };

  /** Pointer position to a chart point, snapping to the nearest candle high/low/open/close within a few pixels. */
  function pointFrom(e: React.PointerEvent): DrawPoint | null {
    const el = svg.current;
    if (!el || !candles.length) return null;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const logical = chart.timeScale().coordinateToLogical(x);
    let price: number | null = series.coordinateToPrice(y);
    if (logical === null || price === null) return null;
    let idx: number = logical;
    const bar = candles[Math.round(logical)];
    if (bar) {
      for (const cand of [bar.high, bar.low, bar.close, bar.open]) {
        const cy = series.priceToCoordinate(cand);
        if (cy !== null && Math.abs(cy - y) < 10) { price = cand; idx = Math.round(logical); break; }
      }
    }
    return { time: logicalToTime(times, idx), price: price as number };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (tool === "cursor") return;
    const p = pointFrom(e);
    if (!p) return;
    e.preventDefault();
    if (tool === "hline") {
      onChange([...drawings, { id: newDrawingId(), kind: "hline", points: [p] }]);
      onToolChange("cursor");
    } else if (!pending) {
      setPending(p);
    } else {
      onChange([...drawings, { id: newDrawingId(), kind: tool, points: [pending, p], extend: tool === "trend" }]);
      setPending(null);
      setCursor(null);
      onToolChange("cursor");
    }
  }

  const { w, h } = size;
  const remove = (id: string) => onChange(drawings.filter((d) => d.id !== id));

  const chip = (x: number, y: number, text: string, color: string, onX?: () => void) => {
    const width = text.length * 6.6 + 16 + (onX ? 14 : 0);
    const cx = Math.min(Math.max(x, 4), Math.max(4, w - width - 68));
    const cy = Math.min(Math.max(y, 14), Math.max(14, h - 26));
    return (
      <g transform={`translate(${cx},${cy - 11})`}>
        <rect width={width} height={20} rx={5} fill="var(--popover)" stroke={color} strokeWidth={1} opacity={0.96} />
        <text x={8} y={14} fontSize={11} fontFamily="var(--font-mono), monospace" fill="var(--popover-foreground)">{text}</text>
        {onX && (
          <g transform={`translate(${width - 15},4)`} style={{ pointerEvents: "auto", cursor: "pointer" }} onClick={onX} role="button" aria-label="Delete drawing">
            <rect width={12} height={12} rx={3} fill="transparent" />
            <path d="M3 3l6 6M9 3l-6 6" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeLinecap="round" />
          </g>
        )}
      </g>
    );
  };

  const renderOne = (d: Drawing, preview = false) => {
    const op = preview ? 0.7 : 1;
    if (d.kind === "hline") {
      const y = Y(d.points[0].price);
      if (y === null) return null;
      const p = pctFrom(d.points[0].price, lastClose);
      return (
        <g key={d.id} opacity={op}>
          <line x1={0} x2={w} y1={y} y2={y} stroke="#d99a1c" strokeWidth={1.5} strokeDasharray={preview ? "4 4" : undefined} />
          {chip(w - 240, y - 12, `${d.points[0].price.toFixed(2)}  ${pct(p)}`, "#d99a1c", preview ? undefined : () => remove(d.id))}
        </g>
      );
    }
    const a = xy(d.points[0]), b = xy(d.points[1]);
    if (!a || !b) return null;
    const m = measure(d.points[0], d.points[1], times);
    if (d.kind === "trend") {
      let ex = b.x, ey = b.y;
      if (d.extend && b.x !== a.x) { ex = Math.max(w, b.x); ey = a.y + ((b.y - a.y) * (ex - a.x)) / (b.x - a.x); }
      const now = lastIdx >= 0 ? drawingPriceAt(d, times, lastIdx) : null;
      const span = inData(d.points) ? `${Math.round(m.bars)} bars` : formatSpan(m.seconds);
      const label = `${m.dPct >= 0 ? "▲" : "▼"} ${pct(m.dPct)} · ${span}${now ? ` · now ${now.toFixed(2)} (${pct(pctFrom(now, lastClose))})` : ""}`;
      return (
        <g key={d.id} opacity={op}>
          <line x1={a.x} y1={a.y} x2={ex} y2={ey} stroke="#3b82f6" strokeWidth={1.75} strokeDasharray={preview ? "4 4" : undefined} />
          <circle cx={a.x} cy={a.y} r={3.5} fill="#3b82f6" /><circle cx={b.x} cy={b.y} r={3.5} fill="#3b82f6" />
          {chip(Math.min(a.x, b.x), Math.max(a.y, b.y) + 24, label, "#3b82f6", preview ? undefined : () => remove(d.id))}
        </g>
      );
    }
    const up = m.dPrice >= 0;
    const col = up ? colors.up : colors.down;
    return (
      <g key={d.id} opacity={op}>
        <rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill={col} fillOpacity={0.12} stroke={col} strokeWidth={1} strokeDasharray="3 3" />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={col} strokeWidth={1.5} />
        <circle cx={a.x} cy={a.y} r={3} fill={col} /><circle cx={b.x} cy={b.y} r={3} fill={col} />
        {chip((a.x + b.x) / 2 - 90, (a.y + b.y) / 2, `${sign(m.dPrice)}${Math.abs(m.dPrice).toFixed(2)} (${pct(m.dPct)}) · ${inData(d.points) ? `${Math.round(m.bars)} bars · ` : ""}${formatSpan(m.seconds)}`, col, preview ? undefined : () => remove(d.id))}
      </g>
    );
  };

  const previewShape = pending && cursor && tool !== "hline" && tool !== "cursor" ? renderOne({ id: "preview", kind: tool, points: [pending, cursor], extend: tool === "trend" }, true) : null;

  return (
    <svg
      ref={svg}
      className="absolute inset-0 z-10 size-full"
      style={{ pointerEvents: tool === "cursor" ? "none" : "auto", cursor: tool === "cursor" ? "default" : "crosshair" }}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => { if (pending) setCursor(pointFrom(e)); }}
      role="img"
      aria-label="Chart drawings"
    >
      {drawings.map((d) => renderOne(d))}
      {previewShape}
      {tool !== "cursor" && (
        <text x={10} y={18} fontSize={11} fill="var(--muted-foreground)">
          {tool === "hline" ? "Click to place a horizontal line" : pending ? "Click the second point" : tool === "trend" ? "Click the first point of the trendline" : "Click the start, then the end, to measure"} · Esc to cancel
        </text>
      )}
    </svg>
  );
}
