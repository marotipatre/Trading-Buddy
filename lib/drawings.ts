import { z } from "zod";

/** A point on the chart: a real timestamp (unix seconds, UTC) and a price. Not tied to one candle size. */
export interface DrawPoint { time: number; price: number }

export type DrawingKind = "hline" | "trend" | "measure";

export interface Drawing {
  id: string;
  kind: DrawingKind;
  /** A horizontal line has two points on the same price (a segment); an older single-point one spans the whole chart. Two points for a trendline or a measurement. */
  points: DrawPoint[];
  /** Trendlines run on to the right edge when true. */
  extend?: boolean;
}

const PointSchema = z.object({ time: z.number().finite(), price: z.number().finite().positive() });
export const DrawingSchema = z.object({
  id: z.string().min(1).max(60),
  kind: z.enum(["hline", "trend", "measure"]),
  points: z.array(PointSchema).min(1).max(2),
  extend: z.boolean().optional(),
}).refine((d) => (d.kind === "hline" ? d.points.length >= 1 : d.points.length === 2), { message: "wrong number of points" });

// ---------- time <-> bar position ----------

/** Typical gap between bars (median), used to place points beyond the data. */
export function barSeconds(times: number[]): number {
  if (times.length < 2) return 86400;
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1]);
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] || 86400;
}

/**
 * Position of a timestamp in bar units (fractional). Between bars it interpolates; before the first or
 * after the last bar it extrapolates using the typical bar gap, so lines can be drawn into the future.
 */
export function timeToLogical(times: number[], t: number): number {
  const n = times.length;
  if (n === 0) return 0;
  if (n === 1) return (t - times[0]) / 86400;
  if (t <= times[0]) return (t - times[0]) / barSeconds(times);
  if (t >= times[n - 1]) return n - 1 + (t - times[n - 1]) / barSeconds(times);
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; }
  return lo + (t - times[lo]) / (times[hi] - times[lo]);
}

export function logicalToTime(times: number[], idx: number): number {
  const n = times.length;
  if (n === 0) return 0;
  if (n === 1) return times[0] + idx * 86400;
  if (idx <= 0) return times[0] + idx * barSeconds(times);
  if (idx >= n - 1) return times[n - 1] + (idx - (n - 1)) * barSeconds(times);
  const lo = Math.floor(idx);
  return times[lo] + (idx - lo) * (times[lo + 1] - times[lo]);
}

// ---------- measurements ----------

export interface Measurement { dPrice: number; dPct: number; bars: number; seconds: number }

export function measure(a: DrawPoint, b: DrawPoint, times: number[]): Measurement {
  const [p, q] = a.time <= b.time ? [a, b] : [b, a];
  return {
    dPrice: b.price - a.price,
    dPct: a.price ? ((b.price - a.price) / a.price) * 100 : NaN,
    bars: Math.abs(timeToLogical(times, q.time) - timeToLogical(times, p.time)),
    seconds: q.time - p.time,
  };
}

/** Price of a trendline at a position (bar units), extending past both points. */
export function trendPriceAt(points: DrawPoint[], times: number[], idx: number): number | null {
  if (points.length !== 2) return null;
  const i1 = timeToLogical(times, points[0].time);
  const i2 = timeToLogical(times, points[1].time);
  if (i1 === i2) return null;
  return points[0].price + ((points[1].price - points[0].price) * (idx - i1)) / (i2 - i1);
}

/** The price a drawing represents at a bar: a horizontal line's price, or a trendline's extrapolated price. */
export function drawingPriceAt(d: Drawing, times: number[], idx: number): number | null {
  return d.kind === "hline" ? d.points[0].price : d.kind === "trend" ? trendPriceAt(d.points, times, idx) : null;
}

/** % difference of `price` from a reference (positive when above it). */
export const pctFrom = (price: number, ref: number) => (ref ? ((price - ref) / ref) * 100 : NaN);

/** Human duration for a measured span: "3d 2h", "45m", "6 weeks". */
export function formatSpan(seconds: number): string {
  const s = Math.abs(seconds);
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  const d = Math.round(s / 86400);
  return d >= 14 ? `${Math.round(d / 7)} weeks` : `${d}d`;
}

// ---------- storage ----------

const key = (symbol: string) => `trading-buddy:drawings:v1:${symbol}`;

export function parseDrawings(raw: string | null): Drawing[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.flatMap((x) => { const r = DrawingSchema.safeParse(x); return r.success ? [r.data as Drawing] : []; }).slice(0, 60);
  } catch {
    return [];
  }
}

export function loadDrawings(symbol: string): Drawing[] {
  try { return parseDrawings(localStorage.getItem(key(symbol))); } catch { return []; }
}

export function saveDrawings(symbol: string, drawings: Drawing[]) {
  try { localStorage.setItem(key(symbol), JSON.stringify(drawings.slice(0, 60))); } catch {}
}

export const newDrawingId = () => `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
