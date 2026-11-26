/**
 * Sector outlook from NSE's own sector indices, using the standard top-down toolkit: multi-period returns against the
 * market, the relative-strength line, a Relative Rotation Graph (RRG) quadrant, trend against the 50 and 200-day
 * averages, and valuation against the index's own history. Everything is computed from published index closes.
 */
export interface Bar { date: string; close: number; pe?: number }

export type Quadrant = "leading" | "weakening" | "lagging" | "improving";
export interface Returns { d1: number; w1: number; m1: number; m3: number; m6: number; y1: number }
export interface RrgPoint { ratio: number; momentum: number; date: string }
export interface SectorOutlook {
  index: string;
  label: string;
  close: number;
  returns: Returns;
  /** Sector return minus the benchmark's, same periods. */
  vsBench: Returns;
  quadrant: Quadrant;
  rrg: RrgPoint[];
  trend: "up" | "down" | "mixed";
  pe?: number;
  /** 0 = cheapest, 100 = most expensive, against this index's own history in the window. */
  pePercentile?: number;
  valuation?: "cheap" | "fair" | "rich";
  score: number;
  stance: "overweight" | "neutral" | "underweight";
  reasons: string[];
}

const OFFSETS: Record<keyof Returns, number> = { d1: 1, w1: 5, m1: 21, m3: 63, m6: 126, y1: 252 };
const ret = (c: number[], k: number) => (c.length > k ? (c[c.length - 1] / c[c.length - 1 - k] - 1) * 100 : NaN);

export function returnsOf(closes: number[]): Returns {
  const o = {} as Returns;
  for (const key of Object.keys(OFFSETS) as (keyof Returns)[]) o[key] = ret(closes, OFFSETS[key]);
  return o;
}
const sub = (a: Returns, b: Returns): Returns => ({ d1: a.d1 - b.d1, w1: a.w1 - b.w1, m1: a.m1 - b.m1, m3: a.m3 - b.m3, m6: a.m6 - b.m6, y1: a.y1 - b.y1 });

const sma = (x: number[], n: number, end = x.length) => (end >= n ? x.slice(end - n, end).reduce((s, v) => s + v, 0) / n : NaN);

/** Align two series on their shared dates (both must be sorted ascending). */
export function align(a: Bar[], b: Bar[]): { date: string; a: number; b: number }[] {
  const m = new Map(b.map((x) => [x.date, x.close]));
  return a.flatMap((x) => (m.has(x.date) ? [{ date: x.date, a: x.close, b: m.get(x.date)! }] : []));
}

/**
 * Relative Rotation Graph coordinates on weekly samples (every fifth session counting back from the latest). RS-Ratio is the
 * relative-strength line against its 10-week average (100 = on its trend); RS-Momentum is the ratio against itself 4 weeks ago.
 * Above 100 on both is "leading"; above on ratio only is "weakening"; below on both is "lagging"; below on ratio only is "improving".
 */
export function rrg(aligned: { date: string; a: number; b: number }[], tail = 8): RrgPoint[] {
  const weekly: { date: string; rs: number }[] = [];
  for (let i = aligned.length - 1; i >= 0; i -= 5) weekly.unshift({ date: aligned[i].date, rs: (aligned[i].a / aligned[i].b) * 100 });
  const rs = weekly.map((w) => w.rs);
  const ratio: number[] = rs.map((_, i) => (i + 1 >= 10 ? (rs[i] / sma(rs, 10, i + 1)) * 100 : NaN));
  const out: RrgPoint[] = [];
  for (let i = 0; i < weekly.length; i++) {
    if (!Number.isFinite(ratio[i]) || i < 4 || !Number.isFinite(ratio[i - 4])) continue;
    out.push({ ratio: ratio[i], momentum: (ratio[i] / ratio[i - 4]) * 100, date: weekly[i].date });
  }
  return out.slice(-tail);
}

export const quadrantOf = (p: { ratio: number; momentum: number }): Quadrant =>
  p.ratio >= 100 ? (p.momentum >= 100 ? "leading" : "weakening") : p.momentum >= 100 ? "improving" : "lagging";

export function valuation(pes: number[]): { pe?: number; pePercentile?: number; valuation?: SectorOutlook["valuation"] } {
  const v = pes.filter((x) => Number.isFinite(x) && x > 0);
  if (v.length < 60) return {};
  const pe = v[v.length - 1];
  const pePercentile = (v.filter((x) => x <= pe).length / v.length) * 100;
  return { pe, pePercentile, valuation: pePercentile >= 80 ? "rich" : pePercentile <= 20 ? "cheap" : "fair" };
}

const QUAD_POINTS: Record<Quadrant, number> = { leading: 100, improving: 70, weakening: 35, lagging: 10 };
const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

/** Outlook for one sector index against a benchmark index. Needs about 8 months of daily closes to be meaningful. */
export function sectorOutlook(index: string, label: string, bars: Bar[], bench: Bar[]): SectorOutlook | null {
  const al = align(bars, bench);
  if (al.length < 150) return null;
  const closes = al.map((x) => x.a), bcloses = al.map((x) => x.b);
  const returns = returnsOf(closes), br = returnsOf(bcloses);
  const vsBench = sub(returns, br);
  const rr = rrg(al);
  const last = rr[rr.length - 1];
  if (!last) return null;
  const quadrant = quadrantOf(last);
  const c = closes[closes.length - 1], s50 = sma(closes, 50), s200 = closes.length >= 200 ? sma(closes, 200) : NaN;
  const trend: SectorOutlook["trend"] = c > s50 && (!Number.isFinite(s200) || c > s200) ? "up" : c < s50 && Number.isFinite(s200) && c < s200 ? "down" : "mixed";
  const val = valuation(bars.map((b) => b.pe ?? NaN));

  // Score: relative momentum matters most, then where the RRG puts it, the trend, and a small nudge from valuation.
  const rel = clamp(50 + vsBench.m3 * 2.2 + vsBench.m1 * 1.4);
  const score = Math.round(clamp(rel * 0.45 + QUAD_POINTS[quadrant] * 0.3 + (trend === "up" ? 100 : trend === "mixed" ? 50 : 0) * 0.15 + (val.valuation === "cheap" ? 100 : val.valuation === "rich" ? 0 : 50) * 0.1));
  const reasons: string[] = [];
  reasons.push(`${returns.m3 >= 0 ? "+" : ""}${returns.m3.toFixed(1)}% over 3 months, ${vsBench.m3 >= 0 ? "ahead of" : "behind"} the market by ${Math.abs(vsBench.m3).toFixed(1)} points`);
  reasons.push(`Relative-strength quadrant: ${quadrant} (ratio ${last.ratio.toFixed(1)}, momentum ${last.momentum.toFixed(1)})`);
  reasons.push(trend === "up" ? "Index is above its 50 and 200-day averages" : trend === "down" ? "Index is below its 50 and 200-day averages" : "Index is mixed against its 50 and 200-day averages");
  if (val.valuation) reasons.push(`P/E ${val.pe!.toFixed(1)}, ${val.pePercentile!.toFixed(0)}th percentile of its own recent range (${val.valuation})`);
  return { index, label, close: c, returns, vsBench, quadrant, rrg: rr, trend, ...val, score, stance: score >= 62 ? "overweight" : score < 40 ? "underweight" : "neutral", reasons };
}

/** NSE sector indices the app tracks, with the stock-universe sector each one stands for (used to give stocks a sector tailwind). */
export const SECTOR_INDICES: { index: string; label: string; sector?: string }[] = [
  { index: "Nifty Auto", label: "Auto", sector: "Auto" },
  { index: "Nifty Bank", label: "Banks", sector: "Financials" },
  { index: "Nifty Private Bank", label: "Private banks" },
  { index: "Nifty PSU Bank", label: "PSU banks" },
  { index: "Nifty Financial Services", label: "Financial services", sector: "Financials" },
  { index: "Nifty NBFC", label: "NBFCs" },
  { index: "Nifty Insurance", label: "Insurance" },
  { index: "Nifty Capital Markets", label: "Capital markets" },
  { index: "Nifty IT", label: "IT", sector: "IT" },
  { index: "Nifty Pharma", label: "Pharma" },
  { index: "Nifty Healthcare Index", label: "Healthcare", sector: "Healthcare" },
  { index: "Nifty FMCG", label: "FMCG", sector: "FMCG" },
  { index: "Nifty Metal", label: "Metals", sector: "Metals & Mining" },
  { index: "Nifty Oil & Gas", label: "Oil & gas", sector: "Oil & Gas" },
  { index: "Nifty Energy", label: "Energy" },
  { index: "Nifty Power", label: "Power", sector: "Power" },
  { index: "Nifty Realty", label: "Realty", sector: "Realty" },
  { index: "Nifty Infrastructure", label: "Infrastructure" },
  { index: "Nifty Construction", label: "Construction", sector: "Construction" },
  { index: "Nifty Capital Goods", label: "Capital goods", sector: "Capital Goods" },
  { index: "Nifty Consumer Durables", label: "Consumer durables", sector: "Consumer Durables" },
  { index: "Nifty India Consumption", label: "Consumption" },
  { index: "Nifty Consumer Services", label: "Consumer services", sector: "Consumer Services" },
  { index: "Nifty Media", label: "Media", sector: "Media" },
  { index: "Nifty Telecommunications", label: "Telecom", sector: "Telecom" },
  { index: "Nifty Chemicals", label: "Chemicals", sector: "Chemicals" },
  { index: "Nifty Cement", label: "Cement", sector: "Cement & Materials" },
  { index: "Nifty India Defence", label: "Defence" },
  { index: "Nifty Transportation & Logistics", label: "Transport & logistics" },
  { index: "Nifty PSE", label: "PSU companies" },
];
export const BENCHMARK_INDEX = "Nifty 500";
