import type { Candle } from "@/lib/data/types";

export type FactorId = "mom" | "high52" | "trend" | "lowvol" | "composite";
export const FACTOR_LABEL: Record<FactorId, string> = { mom: "12-month momentum (skip last month)", high52: "Closeness to 52-week high", trend: "Distance above 200-day average", lowvol: "Low volatility", composite: "Our blend (first three)" };

export interface Quintile { q: number; avgFwd: number; hit: number; n: number }
export interface FactorResult { id: FactorId; quintiles: Quintile[]; spread: number; spreadHit: number; periods: number }
export interface FactorLab { factors: FactorResult[]; universe: number; periods: number; avgAll: number; horizon: number }

const sma = (c: number[], i: number, n: number) => { let s = 0; for (let k = i - n + 1; k <= i; k++) s += c[k]; return s / n; };

function raw(close: number[], i: number): Record<Exclude<FactorId, "composite">, number> | null {
  if (i < 252) return null;
  let hi = 0; for (let k = i - 251; k <= i; k++) hi = Math.max(hi, close[k]);
  const rets: number[] = []; for (let k = i - 59; k <= i; k++) rets.push(close[k] / close[k - 1] - 1);
  const m = rets.reduce((s, v) => s + v, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((s, v) => s + (v - m) ** 2, 0) / rets.length);
  return { mom: close[i - 21] / close[i - 252] - 1, high52: close[i] / hi, trend: close[i] / sma(close, i, 200) - 1, lowvol: -sd };
}

const ranks = (v: number[]) => { const idx = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]); const r = new Array<number>(v.length); idx.forEach(([, i], k) => { r[i] = v.length > 1 ? k / (v.length - 1) : 0.5; }); return r; };

/**
 * Point-in-time factor test. Every `horizon` sessions, using only data up to that day, each stock is scored on a factor,
 * the stocks are split into five groups, and the next `horizon` sessions' returns are recorded per group. If a factor
 * works, the top group (Q5) should beat the bottom group (Q1) consistently, not just once. No fees, no survivorship fix
 * (today's constituents), so treat the numbers as optimistic.
 */
export function factorLab(series: Record<string, Candle[]>, horizon = 21): FactorLab | null {
  const syms = Object.keys(series).filter((s) => series[s].length >= 330);
  if (syms.length < 25) return null;
  const closes = Object.fromEntries(syms.map((s) => [s, series[s].map((c) => c.close)]));
  const times = Object.fromEntries(syms.map((s) => [s, new Map(series[s].map((c, i) => [c.time, i]))]));
  const ref = syms.reduce((a, b) => (series[a].length >= series[b].length ? a : b));
  const refT = series[ref].map((c) => c.time);
  const ids: FactorId[] = ["mom", "high52", "trend", "lowvol", "composite"];
  const acc = Object.fromEntries(ids.map((id) => [id, { q: Array.from({ length: 5 }, () => [] as number[]), spreads: [] as number[] }])) as Record<FactorId, { q: number[][]; spreads: number[] }>;
  const allAvg: number[] = [];
  let periods = 0;
  for (let t = 252; t + horizon < refT.length; t += horizon) {
    const rows: { fwd: number; f: Record<Exclude<FactorId, "composite">, number> }[] = [];
    for (const s of syms) {
      const i = times[s].get(refT[t]), j = times[s].get(refT[t + horizon]);
      if (i === undefined || j === undefined) continue;
      const f = raw(closes[s], i);
      if (f) rows.push({ f, fwd: closes[s][j] / closes[s][i] - 1 });
    }
    if (rows.length < 25) continue;
    periods++;
    allAvg.push(rows.reduce((s, r) => s + r.fwd, 0) / rows.length);
    const base = ["mom", "high52", "trend", "lowvol"] as const;
    const rk = Object.fromEntries(base.map((k) => [k, ranks(rows.map((r) => r.f[k]))])) as Record<(typeof base)[number], number[]>;
    const score: Record<FactorId, number[]> = { ...rk, composite: rows.map((_, i) => (rk.mom[i] + rk.high52[i] + rk.trend[i]) / 3) };
    for (const id of ids) {
      const order = rows.map((_, i) => i).sort((a, b) => score[id][a] - score[id][b]);
      const groups: number[][] = Array.from({ length: 5 }, () => []);
      order.forEach((ri, k) => groups[Math.min(4, Math.floor((k / order.length) * 5))].push(rows[ri].fwd));
      groups.forEach((g, q) => acc[id].q[q].push(g.reduce((s, v) => s + v, 0) / g.length));
      const avg = (g: number[]) => g.reduce((s, v) => s + v, 0) / g.length;
      acc[id].spreads.push(avg(groups[4]) - avg(groups[0]));
    }
  }
  if (periods < 6) return null;
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  return {
    universe: syms.length, periods, horizon, avgAll: mean(allAvg) * 100,
    factors: ids.map((id) => ({
      id, periods, spread: mean(acc[id].spreads) * 100, spreadHit: acc[id].spreads.filter((x) => x > 0).length / periods,
      quintiles: acc[id].q.map((g, q) => ({ q: q + 1, avgFwd: mean(g) * 100, hit: g.filter((x) => x > 0).length / g.length, n: g.length })),
    })),
  };
}

/** Plain-English verdict on one factor. */
export function verdict(f: FactorResult): { tone: "works" | "weak" | "fails"; text: string } {
  const monotonic = f.quintiles[4].avgFwd > f.quintiles[2].avgFwd && f.quintiles[2].avgFwd > f.quintiles[0].avgFwd;
  if (f.spread > 0.4 && f.spreadHit >= 0.58 && monotonic) return { tone: "works", text: `Worked: the top fifth beat the bottom fifth by ${f.spread.toFixed(1)} points a month, in ${(f.spreadHit * 100).toFixed(0)}% of months, and the groups lined up in order.` };
  if (f.spread > 0.15 && f.spreadHit >= 0.5) return { tone: "weak", text: `Weak edge: +${f.spread.toFixed(1)} points a month, but it won only ${(f.spreadHit * 100).toFixed(0)}% of months. Use as a tiebreaker only.` };
  return { tone: "fails", text: `No edge here: the top fifth ${f.spread >= 0 ? "beat" : "lagged"} the bottom fifth by ${Math.abs(f.spread).toFixed(1)} points, winning ${(f.spreadHit * 100).toFixed(0)}% of months.` };
}
