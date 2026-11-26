import type { MarketRow } from "./market";

export type Bucket = "penny" | "small" | "micro" | "other";
export const BUCKET_LABEL: Record<Bucket, string> = { penny: "Penny (under ₹50)", small: "Small cap", micro: "Micro cap", other: "Other listed" };

/** Penny = priced under ₹50 whatever the company size; otherwise by the Nifty list it sits in, or "other listed" if in none. */
export function bucketOf(price: number, cap?: "large" | "mid" | "small" | "micro"): Bucket {
  if (price < 50) return "penny";
  return cap === "small" ? "small" : cap === "micro" ? "micro" : "other";
}

export interface Stage1 { row: MarketRow; cap?: "large" | "mid" | "small" | "micro"; bucket: Bucket; pre: number; why: string[] }

/**
 * First cut over every listed stock using only today's market snapshot: tradable (enough rupees changing hands), not a
 * falling knife, and showing early strength (near its 52-week high, up over 30 days, well off the low). Large and mid
 * caps are left out: this tab hunts the small end of the market where a 5 to 10 times move is possible at all.
 */
export function stage1(rows: MarketRow[], capOf: (symbol: string) => "large" | "mid" | "small" | "micro" | undefined, opts: { minValueCr?: number; minPrice?: number } = {}): Stage1[] {
  const { minValueCr = 0.15, minPrice = 5 } = opts;
  const out: Stage1[] = [];
  for (const r of rows) {
    const cap = capOf(r.symbol);
    if (cap === "large" || cap === "mid") continue;
    if (r.price < minPrice || r.valueCr < minValueCr || r.series === "BE" && r.valueCr < 0.5) continue;
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
    out.push({ row: r, cap, bucket: bucketOf(r.price, cap), pre, why });
  }
  return out.sort((a, b) => b.pre - a.pre);
}
