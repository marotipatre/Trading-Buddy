import { callTool } from "./nse-mcp";
import type { Quote } from "./types";

interface Row { symbol?: string; lastTradedPrice?: number; preClosePrice?: number; change?: number; perChange?: number; highPrice?: number; lowPrice?: number; latestTimestamp?: string }

/** Pure: "2026-11-26 16:00:28" (India time) to unix seconds, or null. */
export function istStampToSec(s?: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s ?? "");
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000 - 19800;
}

/** Pure: a Quote from NSE's live single-stock row. Throws if the numbers are not usable. */
export function quoteFromNse(symbol: string, r: Row): Quote {
  const price = r.lastTradedPrice, prev = r.preClosePrice;
  if (typeof price !== "number" || !(price > 0) || typeof prev !== "number" || !(prev > 0)) throw new Error("NSE returned no usable price");
  const time = istStampToSec(r.latestTimestamp);
  if (time === null) throw new Error("NSE returned no timestamp");
  return {
    symbol, price, prevClose: prev, change: typeof r.change === "number" ? r.change : price - prev,
    changePct: typeof r.perChange === "number" ? r.perChange : ((price - prev) / prev) * 100,
    dayHigh: r.highPrice && r.highPrice > 0 ? r.highPrice : price, dayLow: r.lowPrice && r.lowPrice > 0 ? r.lowPrice : price,
    marketState: "", time, source: "nse",
  };
}

/** NSE's own live quote (delayed by a minute or two) for one stock listed on NSE. */
export async function fetchNseQuote(symbol: string): Promise<Quote> {
  if (!/\.NS$/.test(symbol)) throw new Error("NSE quotes cover NSE symbols only");
  const j = await callTool<{ stock?: Row }>("live", "cm_get_stock_quote", { symbol: symbol.replace(/\.NS$/, "") });
  if (!j.stock) throw new Error("NSE has no quote for this symbol");
  return quoteFromNse(symbol, j.stock);
}
