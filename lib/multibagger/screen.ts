import type { Cap } from "@/lib/universe-lists";
import type { MarketRow } from "./market";

export type Bucket = "penny" | "small" | "micro" | "other" | "sme";
export const BUCKET_LABEL: Record<Bucket, string> = { penny: "Penny (under ₹50)", small: "Small cap", micro: "Micro cap", other: "Other listed", sme: "SME (Emerge)" };

/** Penny = priced under ₹50 whatever the company size; otherwise by the Nifty list it sits in, or "other listed" if in none. */
export function bucketOf(price: number, cap?: Cap): Bucket {
  if (price < 50) return "penny";
  return cap === "sme" ? "sme" : cap === "small" ? "small" : cap === "micro" ? "micro" : "other";
}

export interface Stage1 { row: MarketRow; cap?: Cap; bucket: Bucket; pre: number; why: string[] }

/**
 * First cut over every listed stock using only today's market snapshot: tradable (enough rupees changing hands), not a
 * falling knife, and showing early strength (near its 52-week high, up over 30 days, well off the low). Large and mid
 * caps are left out: this tab hunts the small end of the market where a 5 to 10 times move is possible at all.
 */
export function stage1(rows: MarketRow[], capOf: (symbol: string) => Cap | undefined, opts: { minValueCr?: number; minPrice?: number } = {}): Stage1[] {
  const { minValueCr = 0.15, minPrice = 5 } = opts;
  const out: Stage1[] = [];
  for (const r of rows) {
    const cap = capOf(r.symbol);
    // Only stocks in the app's own universe (which already leaves out ETFs and funds), so every tab agrees on what exists.
    if (cap === undefined || cap === "large" || cap === "mid") continue;
    const sme = r.segment === "sme";
    if (r.price < minPrice || r.valueCr < (sme ? 0.02 : minValueCr) || r.series === "BE" && r.valueCr < 0.5) continue;
    const range = r.high52 - r.low52;
    if (range <= 0) continue;
    const pos = (r.price - r.low52) / range; // 0 at the low, 1 at the high
    const fromHigh = 1 - r.price / r.high52;
    if (pos < 0.35) continue; // still near its lows: no trend to follow
    const why: string[] = [];
    let pre = pos * 50;
    if (fromHigh <= 0.12) { pre += 20; why.push(`Within ${(fromHigh * 100).toFixed(0)}% of its 52-week high`); }
    if (r.chg30d !== null && r.chg30d > 5) { pre += Math.min(20, r.chg30d); why.push(`Up ${r.chg30d.toFixed(0)}% in 30 days`); }
    if (r.price / r.low52 >= 1.5) { pre += 8; why.push(`${((r.price / r.low52 - 1) * 100).toFixed(0)}% above its 52-week low`); }
    pre += Math.min(10, Math.log10(Math.max(1, r.valueCr * 100)) * 3); // a little credit for being easier to trade
    out.push({ row: r, cap, bucket: sme ? "sme" : bucketOf(r.price, cap), pre, why });
  }
  return out.sort((a, b) => b.pre - a.pre);
}

/**
 * Pure: pick `total` stocks from a ranked list while keeping every category (sector) represented: at most `perSector`
 * from any one sector (and `unclassifiedMax` from stocks with no sector), filled in rank order. Falls back to plain rank
 * order if that leaves the list short.
 */
export function diversify<T>(ranked: T[], sectorOf: (x: T) => string, total: number, perSector: number, unclassifiedMax = perSector * 3): T[] {
  const used = new Map<string, number>();
  const out: T[] = [];
  for (const x of ranked) {
    if (out.length >= total) break;
    const sec = sectorOf(x), cap = sec === "Unclassified" ? unclassifiedMax : perSector;
    if ((used.get(sec) ?? 0) >= cap) continue;
    used.set(sec, (used.get(sec) ?? 0) + 1);
    out.push(x);
  }
  if (out.length < total) for (const x of ranked) { if (out.length >= total) break; if (!out.includes(x)) out.push(x); }
  return out;
}
