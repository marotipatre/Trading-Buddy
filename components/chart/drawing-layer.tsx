"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Lock, LockOpen, Trash2 } from "lucide-react";
import type { IChartApi, ISeriesApi, Logical } from "lightweight-charts";
import {
  barSeconds, DRAW_COLORS, fibPrices, formatSpan, logicalToTime, measure, newDrawingId, placeOnce, positionStats, TOOL_INFO, timeToLogical,
  type DrawPoint, type Drawing, type DrawingKind,
} from "@/lib/drawings";
import type { Candle } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export type Tool = "cursor" | DrawingKind;

const sign = (n: number) => (n >= 0 ? "+" : "−");
const pct = (n: number) => `${sign(n)}${Math.abs(n).toFixed(2)}%`;
const DRAG_PX = 7;

interface Props {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick" | "Line">;
  candles: Candle[];
  drawings: Drawing[];
  onChange: (d: Drawing[]) => void;
  tool: Tool;
  onToolChange: (t: Tool) => void;
  colors: { up: string; down: string };
  /** Snap new and moved points to the nearest open, high, low or close. */
  magnet?: boolean;
  /** Stay in the chosen tool after each drawing instead of returning to the cursor. */
  stay?: boolean;
  hidden?: boolean;
}

/**
 * Drawings over the chart, in the way TradingView works: one click places a horizontal line, vertical line, ray, note or position box;
 * two-point tools take click-click or click-and-drag; a selected drawing shows handles and a small style bar; Delete removes it,
 * Ctrl+Z undoes, Esc cancels, and Alt plus a letter picks a tool. Points are real timestamps and prices, so drawings survive a
 * change of timeframe.
 */
export function DrawingLayer({ chart, series, candles, drawings, onChange, tool, onToolChange, colors, magnet = true, stay = false, hidden = false }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0, tick: 0 });
  const [pending, setPending] = useState<DrawPoint[]>([]);
  const [cursor, setCursor] = useState<DrawPoint | null>(null);
  const createDrag = useRef<{ x: number; y: number } | null>(null);
  const [dragInfo, setDragInfo] = useState<{ part: "move" | 0 | 1 | 2; x0: number; y0: number; orig: Drawing } | null>(null);
  const [draft, setDraft] = useState<Drawing | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const latest = useRef<Drawing | null>(null);
  const undo = useRef<Drawing[][]>([]);
  const redo = useRef<Drawing[][]>([]);
  const times = useMemo(() => candles.map((c) => c.time), [candles]);
  const inData = (pts: DrawPoint[]) => times.length > 1 && pts.every((p) => p.time >= times[0] && p.time <= times[times.length - 1]);

  /** Every change goes through here so Ctrl+Z can step back through it. */
  const commit = useCallback((next: Drawing[]) => { undo.current = [...undo.current.slice(-49), drawings]; redo.current = []; onChange(next); }, [drawings, onChange]);

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

  const typing = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      if (e.key === "Escape") { setPending([]); setCursor(null); setSelected(null); setEditing(null); createDrag.current = null; onToolChange("cursor"); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        const d = drawings.find((x) => x.id === selected);
        if (d && !d.locked) { commit(drawings.filter((x) => x.id !== selected)); setSelected(null); }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyZ") {
        e.preventDefault();
        if (e.shiftKey) { const n = redo.current.pop(); if (n) { undo.current.push(drawings); onChange(n); } }
        else { const p = undo.current.pop(); if (p) { redo.current.push(drawings); onChange(p); setSelected(null); } }
        return;
      }
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        const hit = (Object.keys(TOOL_INFO) as DrawingKind[]).find((k) => e.code === `Key${TOOL_INFO[k].key}`);
        if (hit) { e.preventDefault(); onToolChange(hit); }
      }
    };
    const onDown = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest?.("[data-drawing],[data-drawing-ui]")) { setSelected(null); setEditing(null); } };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onDown); };
  }, [onToolChange, onChange, commit, drawings, selected]);

  useEffect(() => {
    if (tool === "cursor") { setPending([]); setCursor(null); }  
  }, [tool]);

  const X = (t: number) => chart.timeScale().logicalToCoordinate(timeToLogical(times, t) as Logical);
  const Y = (p: number) => series.priceToCoordinate(p);
  const xy = (p: DrawPoint): { x: number; y: number } | null => { const x = X(p.time), y = Y(p.price); return x === null || y === null ? null : { x, y }; };
  const axisW = (() => { try { return chart.priceScale("right").width(); } catch { return 60; } })();
  const { w, h } = size;
  const plotR = Math.max(0, w - axisW);
  const plotB = (() => { try { return h - chart.timeScale().height(); } catch { return h - 26; } })();

  /** Pointer position to a chart point, optionally snapping to the nearest candle price within a few pixels. */
  function pointFrom(e: { clientX: number; clientY: number }, snap = magnet): DrawPoint | null {
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
        if (cy !== null && Math.abs(cy - y) < 12) { price = cand; idx = Math.round(logical); break; }
      }
    }
    return { time: logicalToTime(times, idx), price: price as number };
  }

  function startDrag(e: React.PointerEvent, d: Drawing, part: "move" | 0 | 1 | 2) {
    e.preventDefault();
    e.stopPropagation();
    setSelected(d.id);
    if (d.locked) return;
    const r = svg.current?.getBoundingClientRect();
    if (!r) return;
    setDragInfo({ part, x0: e.clientX - r.left, y0: e.clientY - r.top, orig: d });
    setDraft(d);
  }

  useEffect(() => {
    if (!dragInfo) return;
    const g = dragInfo;
    const kind = g.orig.kind;
    const move = (e: PointerEvent) => {
      const el = svg.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const ts = chart.timeScale();
      if (g.part !== "move") {
        const p = pointFrom(e, magnet);
        if (!p) return;
        let pts = g.orig.points.map((q, i) => (i === g.part ? p : q));
        if (kind === "hline") pts = g.orig.points.map((q) => ({ time: q.time, price: p.price }));
        if (kind === "long" || kind === "short") {
          // The stop and target keep sharing one right-hand edge, and each only moves on its own side of the entry.
          const [en, st, tg] = g.orig.points;
          if (g.part === 0) pts = [{ time: Math.min(p.time, st.time - barSeconds(times)), price: p.price }, st, tg];
          if (g.part === 1) pts = [en, { time: Math.max(p.time, en.time + barSeconds(times)), price: p.price }, { ...tg, time: Math.max(p.time, en.time + barSeconds(times)) }];
          if (g.part === 2) pts = [en, { ...st, time: Math.max(p.time, en.time + barSeconds(times)) }, { time: Math.max(p.time, en.time + barSeconds(times)), price: p.price }];
        }
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
          price: kind === "vline" ? q.price : q.price + dP,
          time: kind === "hline" ? q.time : logicalToTime(times, (timeToLogical(times, q.time) as number) + dL),
        })),
      };
      setDraft(latest.current);
    };
    const up = () => {
      const d = latest.current;
      latest.current = null;
      if (d) commit(drawings.map((x) => (x.id === d.id ? d : x)));
      setDraft(null);
      setDragInfo(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers read the latest props through closures on each drag start
  }, [dragInfo]);

  const clicksNeeded = tool === "cursor" ? 0 : TOOL_INFO[tool].clicks;
  // A position box starts about a sixth of the visible width wide, whatever the zoom.
  const spanSeconds = (() => {
    let bars = 20;
    try { const r = chart.timeScale().getVisibleLogicalRange(); if (r) bars = Math.max(6, Math.round((r.to - r.from) / 6)); } catch { /* use the default */ }
    return barSeconds(times) * bars;
  })();

  function finish(d: Drawing) {
    commit([...drawings, d]);
    setSelected(d.id);
    setPending([]);
    setCursor(null);
    createDrag.current = null;
    if (!stay) onToolChange("cursor");
    if (d.kind === "text") setEditing(d.id);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (tool === "cursor") return;
    const p = pointFrom(e);
    if (!p) return;
    e.preventDefault();
    const base = { color: TOOL_INFO[tool].color };
    if (clicksNeeded === 1) { finish({ ...placeOnce(tool, p, { span: spanSeconds }), ...base }); return; }
    if (pending.length === 0) {
      setPending([p]);
      const r = svg.current?.getBoundingClientRect();
      if (r) createDrag.current = { x: e.clientX - r.left, y: e.clientY - r.top };
      return;
    }
    const pts = [...pending, p];
    if (clicksNeeded === 3 && pts.length === 2) {
      if (pts[1].time === pts[0].time) return;
      setPending(pts);
      return;
    }
    if (pts.length === clicksNeeded) {
      if (pts[1].time === pts[0].time && pts[1].price === pts[0].price) return;
      finish({ id: newDrawingId(), kind: tool, points: pts, ...base });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = createDrag.current;
    if (!d || tool === "cursor" || pending.length !== 1 || clicksNeeded !== 2) { createDrag.current = null; return; }
    const r = svg.current?.getBoundingClientRect();
    createDrag.current = null;
    if (!r) return;
    if (Math.hypot(e.clientX - r.left - d.x, e.clientY - r.top - d.y) < DRAG_PX) return; // a plain click: wait for the second click
    const p = pointFrom(e);
    if (p && (p.time !== pending[0].time || p.price !== pending[0].price)) finish({ id: newDrawingId(), kind: tool, points: [pending[0], p], color: TOOL_INFO[tool].color });
  }

  const remove = (id: string) => { commit(drawings.filter((d) => d.id !== id)); setSelected(null); };
  const patch = (id: string, p: Partial<Drawing>) => commit(drawings.map((d) => (d.id === id ? { ...d, ...p } : d)));
  const duplicate = (d: Drawing) => {
    const dP = d.points[0].price * 0.012;
    const copy: Drawing = { ...d, id: newDrawingId(), locked: false, points: d.points.map((q) => ({ time: q.time, price: d.kind === "vline" ? q.price : Math.max(0.01, q.price - dP) })) };
    commit([...drawings, copy]);
    setSelected(copy.id);
  };

  // ---------- drawing ----------
  const priceChip = (y: number, price: number, color: string, key: string) => (
    <g key={key} transform={`translate(${plotR},${y - 9})`} pointerEvents="none">
      <rect width={Math.max(axisW, 44)} height={18} rx={3} fill={color} />
      <text x={6} y={13} fontSize={11} fontWeight={600} fill="#fff" style={{ fontVariantNumeric: "tabular-nums" }}>{price.toFixed(price >= 1000 ? 1 : 2)}</text>
    </g>
  );

  const chip = (x: number, y: number, text: string, color: string) => {
    const width = text.length * 6.4 + 16;
    const cx = Math.min(Math.max(x, 4), Math.max(4, plotR - width - 4));
    const cy = Math.min(Math.max(y, 14), Math.max(14, plotB - 26));
    return (
      <g transform={`translate(${cx},${cy - 11})`} pointerEvents="none">
        <rect width={width} height={20} rx={6} fill="var(--popover)" stroke={color} strokeWidth={1} opacity={0.97} />
        <text x={8} y={14} fontSize={11} fill="var(--popover-foreground)" style={{ fontVariantNumeric: "tabular-nums" }}>{text}</text>
      </g>
    );
  };

  const renderOne = (d: Drawing, preview = false) => {
    const op = preview ? 0.75 : 1;
    const sel = selected === d.id && !preview;
    const col = d.color ?? TOOL_INFO[d.kind].color;
    const sw = (d.width ?? 2) + (sel ? 0.75 : 0);
    const dash = preview ? "5 4" : d.dashed ? "6 4" : undefined;
    const cur = d.locked ? "not-allowed" : "move";
    const hit = (x1: number, y1: number, x2: number, y2: number, cursorStyle = cur) => !preview && (
      <line data-drawing x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={14} style={{ pointerEvents: "stroke", cursor: cursorStyle }} onPointerDown={(e) => startDrag(e, d, "move")} />
    );
    const handles = (pts: { x: number; y: number }[]) => !preview && sel && !d.locked && pts.map((q, i) => (
      <circle key={i} data-drawing cx={q.x} cy={q.y} r={5.5} fill="var(--background)" stroke={col} strokeWidth={2} style={{ pointerEvents: "all", cursor: "grab" }} onPointerDown={(e) => startDrag(e, d, i as 0 | 1 | 2)} />
    ));
    const A = d.points[0] ? xy(d.points[0]) : null;

    if (d.kind === "hline") {
      const y = Y(d.points[0].price);
      if (y === null) return null;
      const pts = d.points.length > 1 ? [xy(d.points[0]), xy(d.points[1])] : null; // an older two-point line is a segment
      const seg = pts && pts[0] && pts[1] ? [pts[0].x, pts[1].x] : null;
      const x1 = seg ? Math.min(...seg) : 0, x2 = seg ? Math.max(...seg) : plotR;
      return (
        <g key={d.id} opacity={op}>
          <line x1={x1} x2={x2} y1={y} y2={y} stroke={col} strokeWidth={sw} strokeDasharray={dash} />
          {hit(x1, y, x2, y, d.locked ? "not-allowed" : "ns-resize")}
          {seg && handles([{ x: x1, y }, { x: x2, y }])}
          {sel && !seg && <circle cx={plotR - 40} cy={y} r={4} fill={col} />}
          {priceChip(y, d.points[0].price, col, `${d.id}-p`)}
        </g>
      );
    }
    if (d.kind === "hray") {
      if (!A) return null;
      return (
        <g key={d.id} opacity={op}>
          <line x1={A.x} x2={plotR} y1={A.y} y2={A.y} stroke={col} strokeWidth={sw} strokeDasharray={dash} />
          {hit(A.x, A.y, plotR, A.y)}
          {handles([A])}
          <circle cx={A.x} cy={A.y} r={3.5} fill={col} />
          {priceChip(A.y, d.points[0].price, col, `${d.id}-p`)}
        </g>
      );
    }
    if (d.kind === "vline") {
      const x = X(d.points[0].time);
      if (x === null) return null;
      return (
        <g key={d.id} opacity={op}>
          <line x1={x} x2={x} y1={0} y2={plotB} stroke={col} strokeWidth={sw} strokeDasharray={dash} />
          {hit(x, 0, x, plotB, d.locked ? "not-allowed" : "ew-resize")}
        </g>
      );
    }
    if (d.kind === "text") {
      if (!A) return null;
      const text = d.text || "Note";
      const width = Math.min(260, text.length * 7 + 18);
      return (
        <g key={d.id} opacity={op} transform={`translate(${A.x},${A.y})`}>
          <circle r={3.5} fill={col} />
          <g transform="translate(8,-24)" data-drawing style={{ pointerEvents: "all", cursor: cur }} onPointerDown={(e) => startDrag(e, d, "move")} onDoubleClick={() => !d.locked && setEditing(d.id)}>
            <rect width={width} height={22} rx={6} fill={col} fillOpacity={0.14} stroke={col} strokeWidth={sel ? 2 : 1} />
            <text x={9} y={15} fontSize={12} fontWeight={600} fill={col} pointerEvents="none">{text.slice(0, 36)}</text>
          </g>
        </g>
      );
    }

    const B = d.points[1] ? xy(d.points[1]) : null;
    if (!A || !B) return null;

    if (d.kind === "trend" || d.kind === "ray") {
      let x2 = B.x, y2 = B.y;
      if (d.kind === "ray" || d.extend) { const dx = B.x - A.x; if (Math.abs(dx) > 0.5) { const k = (B.y - A.y) / dx; x2 = dx > 0 ? plotR : 0; y2 = A.y + k * (x2 - A.x); } }
      return (
        <g key={d.id} opacity={op}>
          <line x1={A.x} y1={A.y} x2={x2} y2={y2} stroke={col} strokeWidth={sw} strokeDasharray={dash} />
          {hit(A.x, A.y, x2, y2)}
          {handles([A, B])}
        </g>
      );
    }
    if (d.kind === "rect") {
      const x = Math.min(A.x, B.x), y = Math.min(A.y, B.y), rw = Math.abs(B.x - A.x), rh = Math.abs(B.y - A.y);
      return (
        <g key={d.id} opacity={op}>
          <rect x={x} y={y} width={rw} height={rh} fill={col} fillOpacity={0.12} stroke={col} strokeWidth={sw} strokeDasharray={dash} data-drawing style={{ pointerEvents: preview ? "none" : "all", cursor: cur }} onPointerDown={(e) => startDrag(e, d, "move")} />
          {handles([A, B])}
        </g>
      );
    }
    if (d.kind === "fib") {
      const xl = Math.min(A.x, B.x), xr = Math.max(A.x, B.x);
      const lv = fibPrices(d.points[0], d.points[1]).map((l) => ({ ...l, y: Y(l.price) }));
      return (
        <g key={d.id} opacity={op}>
          {lv.slice(0, -1).map((l, i) => l.y !== null && lv[i + 1].y !== null && <rect key={`b${i}`} x={xl} y={Math.min(l.y, lv[i + 1].y!)} width={xr - xl} height={Math.abs(lv[i + 1].y! - l.y)} fill={col} fillOpacity={i % 2 ? 0.05 : 0.1} pointerEvents="none" />)}
          {lv.map((l) => l.y !== null && (
            <g key={l.level}>
              <line x1={xl} x2={xr} y1={l.y} y2={l.y} stroke={col} strokeWidth={l.level === 0 || l.level === 1 ? 1.5 : 1} strokeDasharray={l.level === 0.5 ? "4 4" : undefined} />
              {hit(xl, l.y, xr, l.y)}
              <text x={xl + 4} y={l.y - 3} fontSize={10.5} fill={col} fontWeight={600} pointerEvents="none" style={{ fontVariantNumeric: "tabular-nums" }}>{l.level} ({l.price.toFixed(2)})</text>
            </g>
          ))}
          <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={col} strokeWidth={1} strokeDasharray="3 4" opacity={0.7} pointerEvents="none" />
          {handles([A, B])}
        </g>
      );
    }
    if (d.kind === "channel") {
      const P = d.points[2] ? xy(d.points[2]) : null;
      const dx = B.x - A.x;
      const slope = Math.abs(dx) > 0.5 ? (B.y - A.y) / dx : 0;
      const x1 = Math.min(A.x, B.x), x2 = Math.max(A.x, B.x);
      const yAt = (x: number) => A.y + slope * (x - A.x);
      const shift = P ? P.y - yAt(P.x) : 0;
      return (
        <g key={d.id} opacity={op}>
          {P && <polygon points={`${x1},${yAt(x1)} ${x2},${yAt(x2)} ${x2},${yAt(x2) + shift} ${x1},${yAt(x1) + shift}`} fill={col} fillOpacity={0.1} pointerEvents="none" />}
          <line x1={x1} y1={yAt(x1)} x2={x2} y2={yAt(x2)} stroke={col} strokeWidth={sw} strokeDasharray={dash} />
          {P && <line x1={x1} y1={yAt(x1) + shift} x2={x2} y2={yAt(x2) + shift} stroke={col} strokeWidth={sw} strokeDasharray={dash} />}
          {P && <line x1={x1} y1={yAt(x1) + shift / 2} x2={x2} y2={yAt(x2) + shift / 2} stroke={col} strokeWidth={1} strokeDasharray="4 4" opacity={0.6} pointerEvents="none" />}
          {hit(x1, yAt(x1), x2, yAt(x2))}
          {P && hit(x1, yAt(x1) + shift, x2, yAt(x2) + shift)}
          {handles(P ? [A, B, { x: P.x, y: yAt(P.x) + shift }] : [A, B])}
        </g>
      );
    }
    if (d.kind === "measure") {
      const m = measure(d.points[0], d.points[1], times);
      const mcol = m.dPrice >= 0 ? colors.up : colors.down;
      return (
        <g key={d.id} opacity={op}>
          <rect x={Math.min(A.x, B.x)} y={Math.min(A.y, B.y)} width={Math.abs(B.x - A.x)} height={Math.abs(B.y - A.y)} fill={mcol} fillOpacity={0.12} stroke={mcol} strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />
          <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={mcol} strokeWidth={1.5} />
          {hit(A.x, A.y, B.x, B.y)}
          {handles([A, B])}
          {chip((A.x + B.x) / 2 - 90, (A.y + B.y) / 2, `${sign(m.dPrice)}${Math.abs(m.dPrice).toFixed(2)} (${pct(m.dPct)}) · ${inData(d.points) ? `${Math.round(m.bars)} bars · ` : ""}${formatSpan(m.seconds)}`, mcol)}
        </g>
      );
    }
    // long / short position box
    const E = xy(d.points[0]), S = xy(d.points[1]), T = d.points[2] ? xy(d.points[2]) : null;
    if (!E || !S || !T) return null;
    const st = positionStats(d);
    const x1 = E.x, x2 = Math.max(S.x, E.x + 20);
    const long = d.kind === "long";
    const goodCol = colors.up, badCol = colors.down;
    return (
      <g key={d.id} opacity={op}>
        <rect x={x1} y={Math.min(E.y, T.y)} width={x2 - x1} height={Math.abs(T.y - E.y)} fill={goodCol} fillOpacity={0.16} data-drawing style={{ pointerEvents: preview ? "none" : "all", cursor: cur }} onPointerDown={(e) => startDrag(e, d, "move")} />
        <rect x={x1} y={Math.min(E.y, S.y)} width={x2 - x1} height={Math.abs(S.y - E.y)} fill={badCol} fillOpacity={0.16} data-drawing style={{ pointerEvents: preview ? "none" : "all", cursor: cur }} onPointerDown={(e) => startDrag(e, d, "move")} />
        <line x1={x1} x2={x2} y1={E.y} y2={E.y} stroke={col} strokeWidth={sw} pointerEvents="none" />
        <line x1={x1} x2={x2} y1={T.y} y2={T.y} stroke={goodCol} strokeWidth={1.5} pointerEvents="none" />
        <line x1={x1} x2={x2} y1={S.y} y2={S.y} stroke={badCol} strokeWidth={1.5} pointerEvents="none" />
        {st && chip(x1 + 6, T.y + (long ? 16 : -2), `Target ${sign(st.reward)}${Math.abs(st.reward).toFixed(2)} (${pct(st.rewardPct)})`, goodCol)}
        {st && chip(x1 + 6, S.y + (long ? -2 : 16), `Stop ${sign(-st.risk)}${Math.abs(st.risk).toFixed(2)} (${pct(-st.riskPct)}) · R:R ${Number.isFinite(st.rr) ? st.rr.toFixed(2) : "-"}`, badCol)}
        {handles([E, { x: x2, y: S.y }, { x: x2, y: T.y }])}
        {priceChip(E.y, d.points[0].price, col, `${d.id}-e`)}
        {priceChip(S.y, d.points[1].price, badCol, `${d.id}-s`)}
        {priceChip(T.y, d.points[2].price, goodCol, `${d.id}-t`)}
      </g>
    );
  };

  const previewShape = (() => {
    if (tool === "cursor" || !cursor || pending.length === 0 || clicksNeeded === 1) return null;
    const pts = [...pending, cursor].slice(0, clicksNeeded);
     
    if (clicksNeeded === 3 && pts.length < 3) return renderOne({ id: "preview", kind: "trend", points: pts, color: TOOL_INFO[tool].color }, true);
     
    return renderOne({ id: "preview", kind: tool, points: pts, color: TOOL_INFO[tool].color }, true);
  })();

  const selDrawing = drawings.find((d) => d.id === selected);
  const editDrawing = drawings.find((d) => d.id === editing);
  const editPos = editDrawing ? xy(editDrawing.points[0]) : null;
  const hint = tool === "cursor" ? null
    : clicksNeeded === 1 ? `Click to place ${TOOL_INFO[tool].label.toLowerCase()}`
    : pending.length === 0 ? `Click the first point (or click and drag) · ${TOOL_INFO[tool].label}`
    : pending.length === 1 ? "Click the second point" : "Click to set the channel width";

  return (
    <>
      <svg
        ref={svg}
        data-drawing-ui
        className={cn("absolute inset-0 z-10 size-full", hidden && "invisible")}
        style={{ pointerEvents: tool === "cursor" || hidden ? "none" : "auto", cursor: tool === "cursor" ? "default" : "crosshair" }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerMove={(e) => { if (pending.length) setCursor(pointFrom(e)); }}
        role="img"
        aria-label="Chart drawings"
      >
        { }
        {drawings.map((d) => renderOne(draft?.id === d.id ? draft : d))}
        {previewShape}
        {hint && <text x={12} y={18} fontSize={11} fill="var(--muted-foreground)">{hint} · Esc to cancel</text>}
      </svg>

      {selDrawing && !hidden && (
        <div data-drawing-ui className="absolute left-1/2 top-2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-xl border bg-popover/95 p-1 shadow-lg backdrop-blur" role="toolbar" aria-label="Style the selected drawing">
          <span className="whitespace-nowrap px-2 text-xs font-medium text-muted-foreground">{TOOL_INFO[selDrawing.kind].label}</span>
          {DRAW_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => patch(selDrawing.id, { color: c })} className={cn("size-5 rounded-full border-2 transition-transform hover:scale-110", (selDrawing.color ?? TOOL_INFO[selDrawing.kind].color) === c ? "border-foreground" : "border-transparent")} style={{ background: c }} />
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          {([1, 2, 3] as const).map((n) => (
            <button key={n} type="button" aria-label={`Line width ${n}`} aria-pressed={(selDrawing.width ?? 2) === n} onClick={() => patch(selDrawing.id, { width: n })} className={cn("grid size-6 place-items-center rounded-md hover:bg-muted", (selDrawing.width ?? 2) === n && "bg-muted")}><span className="w-4 rounded-full bg-foreground" style={{ height: n }} /></button>
          ))}
          <button type="button" aria-label="Dashed line" aria-pressed={!!selDrawing.dashed} onClick={() => patch(selDrawing.id, { dashed: !selDrawing.dashed })} className={cn("grid size-6 place-items-center rounded-md hover:bg-muted", selDrawing.dashed && "bg-muted")}><span className="w-4 border-t-2 border-dashed border-foreground" /></button>
          <span className="mx-1 h-4 w-px bg-border" />
          <button type="button" aria-label={selDrawing.locked ? "Unlock" : "Lock"} onClick={() => patch(selDrawing.id, { locked: !selDrawing.locked })} className="grid size-6 place-items-center rounded-md hover:bg-muted">{selDrawing.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}</button>
          <button type="button" aria-label="Duplicate" onClick={() => duplicate(selDrawing)} className="grid size-6 place-items-center rounded-md hover:bg-muted"><Copy className="size-3.5" /></button>
          <button type="button" aria-label="Delete drawing" disabled={selDrawing.locked} onClick={() => remove(selDrawing.id)} className="grid size-6 place-items-center rounded-md text-down hover:bg-down/10 disabled:opacity-40"><Trash2 className="size-3.5" /></button>
        </div>
      )}

      {editDrawing && editPos && (
        <input data-drawing-ui autoFocus defaultValue={editDrawing.text ?? "Note"} maxLength={120} aria-label="Note text" onFocus={(e) => e.target.select()}
          className="absolute z-30 h-7 w-56 rounded-md border bg-popover px-2 text-sm shadow-lg outline-none ring-2 ring-primary/40"
          style={{ left: Math.min(editPos.x + 8, Math.max(0, plotR - 230)), top: Math.max(4, editPos.y - 28) }}
          onKeyDown={(e) => { if (e.key === "Enter") { patch(editDrawing.id, { text: (e.target as HTMLInputElement).value.trim() || "Note" }); setEditing(null); } if (e.key === "Escape") setEditing(null); }}
          onBlur={(e) => { patch(editDrawing.id, { text: e.target.value.trim() || "Note" }); setEditing(null); }} />
      )}
    </>
  );
}
