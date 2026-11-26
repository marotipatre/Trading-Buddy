import { z } from "zod";

/** A point on the chart: a real timestamp (unix seconds, UTC) and a price. Not tied to one candle size. */
export interface DrawPoint { time: number; price: number }

export type DrawingKind = "hline" | "hray" | "vline" | "trend" | "ray" | "rect" | "fib" | "channel" | "text" | "measure" | "long" | "short";

export interface Drawing {
  id: string;
  kind: DrawingKind;
  /**
   * Points by kind. hline, hray, vline, text: one point (an older two-point hline still loads). trend, ray, rect, fib, measure: two.
   * channel: the base line (two points) and a third point that sets the parallel line. long, short: entry, stop and target; the stop
   * and target share a time, which is the right-hand edge of the box.
   */
  points: DrawPoint[];
  /** Trendlines run on to the right edge when true. */
  extend?: boolean;
  color?: string;
  width?: 1 | 2 | 3;
  dashed?: boolean;
  locked?: boolean;
  text?: string;
}

/** How many clicks each tool needs, its label and its keyboard shortcut (Alt plus the letter, as on TradingView). */
export const TOOL_INFO: Record<DrawingKind, { label: string; clicks: 1 | 2 | 3; key: string; color: string }> = {
  hline: { label: "Horizontal line", clicks: 1, key: "H", color: "#d99a1c" },
  hray: { label: "Horizontal ray", clicks: 1, key: "J", color: "#d99a1c" },
  vline: { label: "Vertical line", clicks: 1, key: "V", color: "#8b94a3" },
  trend: { label: "Trend line", clicks: 2, key: "T", color: "#3b82f6" },
  ray: { label: "Ray", clicks: 2, key: "R", color: "#3b82f6" },
  rect: { label: "Rectangle", clicks: 2, key: "E", color: "#7c6cf0" },
  fib: { label: "Fib retracement", clicks: 2, key: "F", color: "#d99a1c" },
  channel: { label: "Parallel channel", clicks: 3, key: "C", color: "#3b82f6" },
  text: { label: "Text note", clicks: 1, key: "N", color: "#8b94a3" },
  measure: { label: "Measure", clicks: 2, key: "M", color: "#3b82f6" },
  long: { label: "Long position", clicks: 1, key: "L", color: "#0f9d73" },
  short: { label: "Short position", clicks: 1, key: "S", color: "#e5484d" },
};
export const DRAW_COLORS = ["#3b82f6", "#0f9d73", "#e5484d", "#d99a1c", "#7c6cf0", "#8b94a3"] as const;
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;

const PointSchema = z.object({ time: z.number().finite(), price: z.number().finite().positive() });
const NEED: Record<DrawingKind, [number, number]> = { hline: [1, 2], hray: [1, 1], vline: [1, 1], text: [1, 1], trend: [2, 2], ray: [2, 2], rect: [2, 2], fib: [2, 2], measure: [2, 2], channel: [3, 3], long: [3, 3], short: [3, 3] };
export const DrawingSchema = z.object({
  id: z.string().min(1).max(60),
  kind: z.enum(["hline", "hray", "vline", "trend", "ray", "rect", "fib", "channel", "text", "measure", "long", "short"]),
  points: z.array(PointSchema).min(1).max(3),
  extend: z.boolean().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  width: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  dashed: z.boolean().optional(),
  locked: z.boolean().optional(),
  text: z.string().max(200).optional(),
}).refine((d) => d.points.length >= NEED[d.kind][0] && d.points.length <= NEED[d.kind][1], { message: "wrong number of points" });

/** A new drawing from the first click, for one-click tools (and the defaults for a position box). `span` is the width in seconds for a position box. */
export function placeOnce(kind: DrawingKind, at: DrawPoint, opts: { span: number; stopPct?: number; targetPct?: number; text?: string }): Drawing {
  const id = newDrawingId();
  if (kind === "long" || kind === "short") {
    const sp = (opts.stopPct ?? 2) / 100, tp = (opts.targetPct ?? 4) / 100;
    const long = kind === "long";
    const t2 = at.time + opts.span;
    return { id, kind, points: [at, { time: t2, price: at.price * (long ? 1 - sp : 1 + sp) }, { time: t2, price: at.price * (long ? 1 + tp : 1 - tp) }] };
  }
  return { id, kind, points: [at], ...(kind === "text" ? { text: opts.text ?? "Note" } : {}) };
}

/** Numbers for a position box: risk, reward, their ratio and the percentage moves. */
export function positionStats(d: Drawing): { risk: number; reward: number; rr: number; riskPct: number; rewardPct: number } | null {
  if ((d.kind !== "long" && d.kind !== "short") || d.points.length !== 3) return null;
  const [e, s, t] = d.points;
  const sign = d.kind === "long" ? 1 : -1;
  const risk = (e.price - s.price) * sign, reward = (t.price - e.price) * sign;
  return { risk, reward, rr: risk > 0 ? reward / risk : NaN, riskPct: (risk / e.price) * 100, rewardPct: (reward / e.price) * 100 };
}

/** The Fibonacci retracement levels between two points: level 0 is the second point, 1 is the first. */
export function fibPrices(a: DrawPoint, b: DrawPoint): { level: number; price: number }[] {
  return FIB_LEVELS.map((level) => ({ level, price: b.price + (a.price - b.price) * level }));
}

/** Price of the parallel line of a channel at a position, given the base line's price there. */
export function channelOffset(points: DrawPoint[], times: number[]): number | null {
  if (points.length !== 3) return null;
  const base = trendPriceAt(points.slice(0, 2), times, timeToLogical(times, points[2].time));
  return base === null ? null : points[2].price - base;
}

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
  return d.kind === "hline" || d.kind === "hray" ? d.points[0].price : d.kind === "trend" || d.kind === "ray" ? trendPriceAt(d.points, times, idx) : null;
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
