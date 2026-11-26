import { createSpacer } from "./spacer";
import type { Candle, Interval } from "./types";

/**
 * Second source of price HISTORY, from the public chart endpoint behind Moneycontrol's charts.
 * - Used alongside Yahoo with automatic failover; requests are spaced and cached by the caller.
 * - Unofficial: it can change or block without notice. Low-volume personal use only.
 * - Prices are split/bonus adjusted (verified: no overnight halving across RELIANCE's 2017/2024 bonus issues).
 * - Covers NSE equities only (RELIANCE.NS -> RELIANCE).
 */

const RESOLUTION: Record<Interval, string> = { "1d": "1D", "15m": "15", "5m": "5", "1m": "1" };
const MAX_BARS = 3000;
const IST_OFFSET = 19800;

export function toMoneycontrolSymbol(yahoo: string): string | null {
  const m = yahoo.trim().toUpperCase().match(/^([A-Z0-9&_-]+)\.NS$/);
  return m ? m[1] : null;
}

/** Daily bars are stamped at the NSE open (09:15 IST), the same convention Yahoo uses, so both sources share cache rows. */
export function normalizeDailyTime(sec: number): number {
  const dayStartIst = Math.floor((sec + IST_OFFSET) / 86400) * 86400 - IST_OFFSET;
  return dayStartIst + 9 * 3600 + 15 * 60;
}

interface McResponse { s?: string; t?: number[]; o?: number[]; h?: number[]; l?: number[]; c?: number[]; v?: number[] }

/** Pure: validate and convert the response; drops malformed bars, dedupes and sorts. */
export function parseMoneycontrolHistory(json: unknown, interval: Interval): Candle[] {
  const d = json as McResponse;
  if (!d || d.s !== "ok" || !Array.isArray(d.t) || !Array.isArray(d.o) || !Array.isArray(d.h) || !Array.isArray(d.l) || !Array.isArray(d.c)) return [];
  const byTime = new Map<number, Candle>();
  for (let i = 0; i < d.t.length; i++) {
    const [o, h, l, c] = [d.o[i], d.h[i], d.l[i], d.c[i]];
    if (![o, h, l, c].every((x) => typeof x === "number" && Number.isFinite(x) && x > 0)) continue;
    if (h < l || h < Math.max(o, c) - 1e-9 || l > Math.min(o, c) + 1e-9) continue;
    const time = interval === "1d" ? normalizeDailyTime(d.t[i]) : d.t[i];
    byTime.set(time, { time, open: o, high: h, low: l, close: c, volume: Number.isFinite(d.v?.[i]) ? (d.v![i] as number) : 0 });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

const spaced = createSpacer({ minGapMs: 500 });

export async function fetchMoneycontrolCandles(
  yahooSymbol: string,
  interval: Interval,
  fromSec: number,
  toSec: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Candle[]> {
  const sym = toMoneycontrolSymbol(yahooSymbol);
  if (!sym) throw new Error(`${yahooSymbol}: not supported by the Moneycontrol source (NSE equities only)`);
  const perDay = interval === "1d" ? 0.72 : interval === "15m" ? 25 : interval === "5m" ? 75 : 375;
  const countback = Math.min(MAX_BARS, Math.ceil(((toSec - fromSec) / 86400) * perDay) + 30);
  const url =
    `https://priceapi.moneycontrol.com/techCharts/indianMarket/stock/history?symbol=${encodeURIComponent(sym)}` +
    `&resolution=${RESOLUTION[interval]}&from=${Math.floor(fromSec)}&to=${Math.floor(toSec)}&countback=${countback}&currencyCode=INR`;
  const json = await spaced(async () => {
    const res = await fetchImpl(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        Referer: "https://www.moneycontrol.com/",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Moneycontrol HTTP ${res.status}`);
    return res.json();
  });
  const all = parseMoneycontrolHistory(json, interval);
  const bars = all.filter((c) => c.time >= fromSec - 86400 && c.time <= toSec + 86400);
  if (!bars.length) throw new Error(`${yahooSymbol}: no price history returned by Moneycontrol`);
  return bars;
}
