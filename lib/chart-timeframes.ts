import type { Candle, Interval } from "@/lib/data/types";
import { istDay } from "./chart-ranges";

export type TimeframeId = "5m" | "15m" | "4h" | "1d" | "1w";

export interface Timeframe {
  id: TimeframeId;
  label: string;
  /** The candles actually downloaded. */
  source: Interval;
  /** How far back to load by default. */
  days: number;
  aggregate?: "4h" | "1w";
  intraday: boolean;
}

/** Candle sizes like a charting platform. 4H and 1W are built from 15-minute and daily candles. */
export const TIMEFRAMES: Timeframe[] = [
  { id: "5m", label: "5m", source: "5m", days: 12, intraday: true },
  { id: "15m", label: "15m", source: "15m", days: 40, intraday: true },
  { id: "4h", label: "4H", source: "15m", days: 220, aggregate: "4h", intraday: true },
  { id: "1d", label: "1D", source: "1d", days: 730, intraday: false },
  { id: "1w", label: "1W", source: "1d", days: 3650, aggregate: "1w", intraday: false },
];

export const getTimeframe = (id: string): Timeframe => TIMEFRAMES.find((t) => t.id === id) ?? TIMEFRAMES[3];

const IST = 19800;

function merge(bars: Candle[]): Candle {
  return {
    time: bars[0].time,
    open: bars[0].open,
    high: Math.max(...bars.map((b) => b.high)),
    low: Math.min(...bars.map((b) => b.low)),
    close: bars[bars.length - 1].close,
    volume: bars.reduce((a, b) => a + b.volume, 0),
  };
}

/**
 * 4-hour candles for the NSE session (09:15 to 15:30 IST). A day has two: 09:15 to 13:15, and 13:15 to the close.
 * This matches how Indian platforms draw 4H candles, since a plain 4-hour split would cut the day in odd places.
 */
export function aggregate4h(bars: Candle[]): Candle[] {
  const out: Candle[] = [];
  let group: Candle[] = [];
  let key = "";
  for (const b of [...bars].sort((a, c) => a.time - c.time)) {
    const minutes = Math.floor((((b.time + IST) % 86400) + 86400) % 86400 / 60);
    const k = `${istDay(b.time)}|${minutes >= 13 * 60 + 15 ? 1 : 0}`;
    if (k !== key && group.length) { out.push(merge(group)); group = []; }
    key = k;
    group.push(b);
  }
  if (group.length) out.push(merge(group));
  return out;
}

/** Weekly candles: Monday to Friday (IST). Each is stamped with its first trading day. */
export function aggregateWeekly(bars: Candle[]): Candle[] {
  const out: Candle[] = [];
  let group: Candle[] = [];
  let week = NaN;
  for (const b of [...bars].sort((a, c) => a.time - c.time)) {
    const w = Math.floor((istDay(b.time) + 3) / 7); // 1 Jan 1970 was a Thursday, so +3 aligns weeks to Monday
    if (w !== week && group.length) { out.push(merge(group)); group = []; }
    week = w;
    group.push(b);
  }
  if (group.length) out.push(merge(group));
  return out;
}

/** Turn downloaded candles into the chosen timeframe. */
export function toTimeframe(bars: Candle[], tf: Timeframe): Candle[] {
  return tf.aggregate === "4h" ? aggregate4h(bars) : tf.aggregate === "1w" ? aggregateWeekly(bars) : bars;
}

/** Monthly candles (IST calendar months), each stamped with its first trading day. */
export function aggregateMonthly(bars: Candle[]): Candle[] {
  const out: Candle[] = [];
  let group: Candle[] = [];
  let key = "";
  for (const b of [...bars].sort((a, c) => a.time - c.time)) {
    const d = new Date((b.time + 19800) * 1000);
    const k = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    if (k !== key && group.length) { out.push(merge(group)); group = []; }
    key = k;
    group.push(b);
  }
  if (group.length) out.push(merge(group));
  return out;
}
