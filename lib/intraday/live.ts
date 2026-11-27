import type { Candle } from "@/lib/data/types";
import type { IntradayPick } from "./picks";

export type LiveCall = "waiting" | "go" | "extended" | "weak" | "stopped" | "target" | "skip-gap" | "closed";
export interface LiveStatus {
  call: LiveCall;
  /** One plain sentence on what to do now. */
  say: string;
  price: number;
  vwap: number | null;
  /** High and low of the first 15 minutes (three 5-minute candles), once they are complete. */
  orHigh: number | null;
  orLow: number | null;
}

const istDate = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10);
const istMin = (t: number) => { const d = new Date((t + 19800) * 1000); return d.getUTCHours() * 60 + d.getUTCMinutes(); };

/** Volume-weighted average price over the candles given, using each candle's typical price. Null when there is no volume. */
export function vwap(bars: Pick<Candle, "high" | "low" | "close" | "volume">[]): number | null {
  let pv = 0, v = 0;
  for (const b of bars) { pv += ((b.high + b.low + b.close) / 3) * b.volume; v += b.volume; }
  return v > 0 ? pv / v : null;
}

/**
 * Where a pick stands during its session, from the 5-minute candles so far. The rules are the usual day-trading
 * confirmations: price at or above the entry, above VWAP (buyers in control) and above the opening range high, and not
 * already stretched more than a third of the way to the target.
 */
export function liveStatus(pick: Pick<IntradayPick, "plan" | "forDate"> & { side?: "long" | "short" }, bars5: Candle[]): LiveStatus | null {
  const day = bars5.filter((b) => istDate(b.time) === pick.forDate && istMin(b.time) >= 9 * 60 + 15 && istMin(b.time) < 15 * 60 + 30).sort((a, b) => a.time - b.time);
  if (!day.length) return null;
  const short = pick.side === "short";
  const { entry, stop, target1 } = pick.plan;
  const last = day[day.length - 1];
  const price = last.close;
  const opening = day.filter((b) => istMin(b.time) < 9 * 60 + 30);
  const orDone = day.some((b) => istMin(b.time) >= 9 * 60 + 30);
  const orHigh = orDone ? Math.max(...opening.map((b) => b.high)) : null;
  const orLow = orDone ? Math.min(...opening.map((b) => b.low)) : null;
  const v = vwap(day);
  const base = { price, vwap: v, orHigh, orLow };
  const first = day[0];
  const gapped = short ? first.open < entry * 0.99 || first.open >= stop : first.open > entry * 1.01 || first.open <= stop;
  if (gapped) return { ...base, call: "skip-gap", say: short ? (first.open >= stop ? "It opened at or above the stop. Skip it." : "It gapped more than 1% below the entry. Skip it; chasing a gap is how stops get hit.") : (first.open <= stop ? "It opened at or below the stop. Skip it." : "It gapped more than 1% above the entry. Skip it; chasing a gap is how stops get hit.") };
  if (istMin(last.time) >= 15 * 60 + 10) return { ...base, call: "closed", say: "The session is ending. Be flat by 3:15 pm." };
  const entered = day.some((b) => (short ? b.low <= entry : b.high >= entry));
  if (entered && (short ? price >= stop || day.some((b) => b.high >= stop) && last.high >= stop : price <= stop || day.some((b) => b.low <= stop) && last.low <= stop)) return { ...base, call: "stopped", say: "Price has hit the stop level. The idea failed; do not re-enter." };
  if (entered && day.some((b) => (short ? b.low <= target1 : b.high >= target1))) return { ...base, call: "target", say: "Target 1 was reached. Book profit and trail the rest." };
  if (!entered) return { ...base, call: "waiting", say: short ? `Not triggered yet. Sell short only if price trades down to ${entry.toFixed(2)}.` : `Not triggered yet. Buy only if price trades up to ${entry.toFixed(2)}.` };
  if (short ? price < entry - (entry - target1) * 0.33 : price > entry + (target1 - entry) * 0.33) return { ...base, call: "extended", say: "Triggered but already well past the entry. Do not chase; the risk-to-reward is now worse." };
  const rightOfVwap = v === null || (short ? price <= v : price >= v);
  const rightOfOr = short ? orLow === null || price <= orLow : orHigh === null || price >= orHigh;
  if (rightOfVwap && rightOfOr) return { ...base, call: "go", say: short ? "Triggered with sellers in control: price is below VWAP and the opening range low." : "Triggered with buyers in control: price is above VWAP and the opening range high." };
  return { ...base, call: "weak", say: !rightOfVwap ? (short ? "Triggered but above VWAP: buyers are in control. Wait or skip." : "Triggered but below VWAP: sellers are in control. Wait or skip.") : (short ? "Triggered but still above the opening range low. Wait for it to break." : "Triggered but still under the opening range high. Wait for it to clear.") };
}

export const CALL_LABEL: Record<LiveCall, string> = { waiting: "Waiting", go: "Go", extended: "Don't chase", weak: "Weak", stopped: "Stopped out", target: "Target hit", "skip-gap": "Skip: gapped", closed: "Closing" };
export const CALL_TONE: Record<LiveCall, "up" | "down" | "warn" | "muted"> = { waiting: "muted", go: "up", extended: "warn", weak: "warn", stopped: "down", target: "up", "skip-gap": "down", closed: "muted" };
