"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, Logical } from "lightweight-charts";
import { formatSpan, logicalToTime, measure, newDrawingId, timeToLogical, type DrawPoint, type Drawing } from "@/lib/drawings";
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
  /** The drawing being dragged. It is shown live and only saved when you let go. */
  const [dragInfo, setDragInfo] = useState<{ part: "move" | 0 | 1; x0: number; y0: number; orig: Drawing } | null>(null);
  const [draft, setDraft] = useState<Drawing | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const latest = useRef<Drawing | null>(null);
  const times = useMemo(() => candles.map((c) => c.time), [candles]);
  /** Bar counts are only meaningful when both points lie inside the loaded candles; otherwise they are extrapolated. */
  const inData = (pts: DrawPoint[]) => times.length > 1 && pts.every((p) => p.time >= times[0] && p.time <= times[times.length - 1]);

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

  // Escape cancels a drawing in progress. Delete removes the selected drawing. A click anywhere else deselects.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPending(null); setCursor(null); setSelected(null); onToolChange("cursor"); }
      else if ((e.key === "Delete" || e.key === "Backspace") && selected && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        onChange(drawings.filter((d) => d.id !== selected));
        setSelected(null);
      }
    };
    const onDown = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest?.("[data-drawing]")) setSelected(null); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onDown); };
  }, [onToolChange, onChange, drawings, selected]);

  useEffect(() => {
    if (tool === "cursor") { setPending(null); setCursor(null); } // eslint-disable-line react-hooks/set-state-in-effect -- leaving a tool abandons a half-drawn shape
  }, [tool]);

  const X = (t: number) => chart.timeScale().logicalToCoordinate(timeToLogical(times, t) as Logical);
  const Y = (p: number) => series.priceToCoordinate(p);
  const xy = (p: DrawPoint): { x: number; y: number } | null => { const x = X(p.time), y = Y(p.price); return x === null || y === null ? null : { x, y }; };

  /** Pointer position to a chart point, snapping to the nearest candle high/low/open/close within a few pixels. */
  function pointFrom(e: { clientX: number; clientY: number }, snap = true): DrawPoint | null {
    const el = svg.current;
    if (!el || !candles.length) return null;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const logical = chart.timeScale().coordinateToLogical(x);
    let price: number | null = series.coordinateToPrice(y);
    if (logical === null || price === null) return null;
    let idx: number = logical;
    const bar = candles[Math.round(logical)];
    if (bar && snap) {
      for (const cand of [bar.high, bar.low, bar.close, bar.open]) {
        const cy = series.priceToCoordinate(cand);
        if (cy !== null && Math.abs(cy - y) < 10) { price = cand; idx = Math.round(logical); break; }
      }
    }
    return { time: logicalToTime(times, idx), price: price as number };
  }

  /** Start dragging a whole drawing, or one of its end handles. */
  function startDrag(e: React.PointerEvent, d: Drawing, part: "move" | 0 | 1) {
    e.preventDefault();
    e.stopPropagation();
    const r = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect();
    if (!r) return;
    setSelected(d.id);
    setDragInfo({ part, x0: e.clientX - r.left, y0: e.clientY - r.top, orig: d });
    setDraft(d);
  }

  useEffect(() => {
    if (!dragInfo) return;
    const g = dragInfo;
    const move = (e: PointerEvent) => {
      const el = svg.current;
      if (!g || !el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const ts = chart.timeScale();
      if (g.part !== "move") {
        const p = pointFrom(e, true);
        if (!p) return;
        const pts = g.orig.kind === "hline" ? g.orig.points.map((q, i) => ({ time: i === g.part ? p.time : q.time, price: p.price })) : g.orig.points.map((q, i) => (i === g.part ? p : q));
        latest.current = { ...g.orig, points: pts };
        setDraft(latest.current);
        return;
      }
      const l0 = ts.coordinateToLogical(g.x0), l1 = ts.coordinateToLogical(x);
      const p0 = series.coordinateToPrice(g.y0), p1 = series.coordinateToPrice(y);
      if (l0 === null || l1 === null || p0 === null || p1 === null) return;
      const dP = (p1 as number) - (p0 as number), dL = l1 - l0;
      latest.current = {
        ...g.orig,
        points: g.orig.points.map((q) => ({
          price: q.price + dP,
          time: g.orig.kind === "hline" ? q.time : logicalToTime(times, (timeToLogical(times, q.time) as number) + dL),
        })),
      };
      setDraft(latest.current);
    };
    const up = () => {
      const d = latest.current;
      latest.current = null;
      if (d) onChange(drawings.map((x) => (x.id === d.id ? d : x)));
      setDraft(null);
      setDragInfo(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers read the latest props through closures on each drag start
  }, [dragInfo]);

  function onPointerDown(e: React.PointerEvent) {
    if (tool === "cursor") return;
    const p = pointFrom(e);
    if (!p) return;
    e.preventDefault();
    if (!pending) {
      setPending(p);
    } else {
      const end = tool === "hline" ? { time: p.time, price: pending.price } : p; // a horizontal line stays level
      if (end.time === pending.time && (tool === "hline" || end.price === pending.price)) return; // needs two different points
      const id = newDrawingId();
      onChange([...drawings, { id, kind: tool, points: [pending, end] }]);
      setSelected(id);
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
    const sel = selected === d.id && !preview;
    const handles = (pts: { x: number; y: number }[], color: string) => !preview && (
      <>
        {pts.map((q, i) => (
          <circle key={i} data-drawing cx={q.x} cy={q.y} r={sel ? 5 : 8} fill={sel ? "var(--background)" : "transparent"} stroke={sel ? color : "none"} strokeWidth={2}
            style={{ pointerEvents: "all", cursor: "grab" }} onPointerDown={(e) => startDrag(e, d, i as 0 | 1)} />
        ))}
      </>
    );
    if (d.kind === "hline") {
      const y = Y(d.points[0].price);
      if (y === null) return null;
      const a = d.points.length > 1 ? xy(d.points[0]) : null, b = d.points.length > 1 ? xy(d.points[1]) : null;
      const x1 = a && b ? a.x : 0, x2 = a && b ? b.x : w; // an older single-point line spans the chart
      return (
        <g key={d.id} opacity={op}>
          <line x1={x1} x2={x2} y1={y} y2={y} stroke="#d99a1c" strokeWidth={sel ? 2.25 : 1.5} strokeDasharray={preview ? "4 4" : undefined} />
          {!preview && <line data-drawing x1={x1} x2={x2} y1={y} y2={y} stroke="transparent" strokeWidth={14} style={{ pointerEvents: "stroke", cursor: "ns-resize" }} onPointerDown={(e) => startDrag(e, d, "move")} />}
          {a && b && handles([{ x: a.x, y }, { x: b.x, y }], "#d99a1c")}
        </g>
      );
    }
    const a = xy(d.points[0]), b = xy(d.points[1]);
    if (!a || !b) return null;
    const m = measure(d.points[0], d.points[1], times);
    if (d.kind === "trend") {
      return (
        <g key={d.id} opacity={op}>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#3b82f6" strokeWidth={sel ? 2.5 : 1.75} strokeDasharray={preview ? "4 4" : undefined} />
          {!preview && <line data-drawing x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={12} style={{ pointerEvents: "stroke", cursor: "move" }} onPointerDown={(e) => startDrag(e, d, "move")} />}
          {handles([a, b], "#3b82f6")}
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
        {!preview && <>
          <line data-drawing x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={12} style={{ pointerEvents: "stroke", cursor: "move" }} onPointerDown={(e) => startDrag(e, d, "move")} />
          {handles([a, b], col)}
        </>}
        {chip((a.x + b.x) / 2 - 90, (a.y + b.y) / 2, `${sign(m.dPrice)}${Math.abs(m.dPrice).toFixed(2)} (${pct(m.dPct)}) · ${inData(d.points) ? `${Math.round(m.bars)} bars · ` : ""}${formatSpan(m.seconds)}`, col, preview ? undefined : () => remove(d.id))}
      </g>
    );
  };

  const previewShape = pending && cursor && tool !== "cursor" ? renderOne({ id: "preview", kind: tool, points: [pending, tool === "hline" ? { time: cursor.time, price: pending.price } : cursor] }, true) : null;

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
      {drawings.map((d) => renderOne(draft?.id === d.id ? draft : d))}
      {previewShape}
      {tool !== "cursor" && (
        <text x={10} y={18} fontSize={11} fill="var(--muted-foreground)">
          {pending ? "Click the second point" : tool === "hline" ? "Click where the line starts" : tool === "trend" ? "Click the first point of the trendline" : "Click the start, then the end, to measure"} · Esc to cancel
        </text>
      )}
    </svg>
  );
}
