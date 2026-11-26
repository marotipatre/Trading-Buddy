import { gunzipSync } from "node:zlib";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isMarketOpen } from "@/lib/market-hours";
import { normalizeDailyTime } from "./moneycontrol";
import { createSpacer, dedupe } from "./spacer";
import type { Candle, Interval, Quote } from "./types";

/**
 * Market data from Upstox's public candle endpoints (api.upstox.com). They are open: no login,
 * API key or token is needed for historical and intraday candles. Instrument keys come from
 * Upstox's public instrument list. Covers NSE equities and major indices, daily and intraday
 * (5m and 15m reach back years), plus today's bars, so it also works as a live-ish quote source.
 * Unofficial in the sense that it is not a contract: terms can change, so it fails over to the others.
 */

const BASE = "https://api.upstox.com/v3/historical-candle";
const INSTRUMENTS_URL = "https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz";
const IST = 19800;

export const INDEX_KEYS: Record<string, string> = {
  "^NSEI": "NSE_INDEX|Nifty 50",
  "^NSEBANK": "NSE_INDEX|Nifty Bank",
  "^CNXIT": "NSE_INDEX|Nifty IT",
  "^INDIAVIX": "NSE_INDEX|India VIX",
  "^BSESN": "BSE_INDEX|SENSEX",
};

// ---------- instrument list -> compact ticker map ----------

export interface InstrumentRow { segment?: string; instrument_type?: string; trading_symbol?: string; instrument_key?: string }

/** Pure: reduce the ~86k-row instrument list to ticker -> instrument key for NSE equities. */
export function buildInstrumentMap(rows: InstrumentRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.segment === "NSE_EQ" && r.instrument_type === "EQ" && r.trading_symbol && r.instrument_key) out[r.trading_symbol] = r.instrument_key;
  }
  return out;
}

/** Pure: Yahoo-style symbol -> Upstox instrument key, or null. */
export function toUpstoxKey(yahoo: string, map: Record<string, string>): string | null {
  const s = yahoo.trim().toUpperCase();
  if (INDEX_KEYS[s]) return INDEX_KEYS[s];
  const m = s.match(/^([A-Z0-9&_-]+)\.NS$/);
  return m ? map[m[1]] ?? null : null;
}

const CACHE_FILE = join(tmpdir(), "trading-buddy-upstox-instruments.json");
const DAY_MS = 86_400_000;
let memo: { map: Record<string, string>; at: number } | null = null;
const loading = dedupe<Record<string, string>>();

/** Ticker map, cached in memory and in a temp file for a day (the raw list is ~2 MB gzipped, 42 MB of JSON). */
export async function getInstrumentMap(fetchImpl: typeof fetch = fetch): Promise<Record<string, string>> {
  if (memo && Date.now() - memo.at < DAY_MS) return memo.map;
  return loading("map", async () => {
    try {
      if (existsSync(CACHE_FILE) && Date.now() - statSync(CACHE_FILE).mtimeMs < DAY_MS) {
        const map = JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Record<string, string>;
        if (Object.keys(map).length > 500) return (memo = { map, at: Date.now() }).map;
      }
    } catch {}
    const res = await fetchImpl(INSTRUMENTS_URL, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`Upstox instrument list HTTP ${res.status}`);
    const rows = JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8")) as InstrumentRow[];
    const map = buildInstrumentMap(rows);
    if (Object.keys(map).length < 500) throw new Error("Upstox instrument list looked wrong");
    try { writeFileSync(CACHE_FILE, JSON.stringify(map)); } catch {}
    memo = { map, at: Date.now() };
    return map;
  });
}

// ---------- requests ----------

type Row = [string, number, number, number, number, number, number?];

/** Pure: Upstox returns newest-first rows with ISO timestamps. */
export function parseUpstoxCandles(json: unknown, interval: Interval): Candle[] {
  const rows = (json as { data?: { candles?: Row[] } })?.data?.candles;
  if (!Array.isArray(rows)) return [];
  const byTime = new Map<number, Candle>();
  for (const r of rows) {
    const [ts, o, h, l, c, v] = r;
    const sec = Math.floor(Date.parse(ts) / 1000);
    if (!Number.isFinite(sec) || ![o, h, l, c].every((x) => typeof x === "number" && Number.isFinite(x) && x > 0)) continue;
    if (h < l || h < Math.max(o, c) - 1e-9 || l > Math.min(o, c) + 1e-9) continue;
    const time = interval === "1d" ? normalizeDailyTime(sec) : sec;
    byTime.set(time, { time, open: o, high: h, low: l, close: c, volume: Number.isFinite(v) ? v : 0 });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

const UNIT: Record<Interval, { unit: "days" | "minutes"; n: number; chunkDays: number; maxDays: number }> = {
  "1d": { unit: "days", n: 1, chunkDays: 3650, maxDays: 365 * 12 },
  "15m": { unit: "minutes", n: 15, chunkDays: 28, maxDays: 365 },
  "5m": { unit: "minutes", n: 5, chunkDays: 28, maxDays: 365 },
  "1m": { unit: "minutes", n: 1, chunkDays: 7, maxDays: 60 },
};

const istDate = (sec: number) => new Date((sec + IST) * 1000).toISOString().slice(0, 10);

/** Pure: split [from,to] into the date windows Upstox will accept in one request, newest first. */
export function planChunks(interval: Interval, fromSec: number, toSec: number): { from: string; to: string }[] {
  const { chunkDays, maxDays } = UNIT[interval];
  const from = Math.max(fromSec, toSec - maxDays * 86400);
  const out: { from: string; to: string }[] = [];
  let end = toSec;
  while (end > from) {
    const start = Math.max(from, end - (chunkDays - 1) * 86400);
    out.push({ from: istDate(start), to: istDate(end) });
    end = start - 86400;
  }
  return out;
}

const spaced = createSpacer({ minGapMs: 120 });

async function getJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  return spaced(async () => {
    const res = await fetchImpl(url, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Upstox HTTP ${res.status}`);
    return res.json();
  });
}

const enc = encodeURIComponent;

export async function fetchUpstoxCandles(
  yahooSymbol: string,
  interval: Interval,
  fromSec: number,
  toSec: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Candle[]> {
  const map = await getInstrumentMap(fetchImpl);
  const key = toUpstoxKey(yahooSymbol, map);
  if (!key) throw new Error(`${yahooSymbol}: not found in the Upstox instrument list`);
  const { unit, n } = UNIT[interval];
  const all = new Map<number, Candle>();
  for (const c of planChunks(interval, fromSec, toSec)) {
    const json = await getJson(`${BASE}/${enc(key)}/${unit}/${n}/${c.to}/${c.from}`, fetchImpl);
    for (const bar of parseUpstoxCandles(json, interval)) all.set(bar.time, bar);
  }
  // The history endpoint stops at the previous session; today's bar(s) come from the intraday endpoint.
  try {
    const today = await getJson(`${BASE}/intraday/${enc(key)}/${unit}/${n}`, fetchImpl);
    for (const bar of parseUpstoxCandles(today, interval)) all.set(bar.time, bar);
  } catch {}
  const bars = [...all.values()].filter((b) => b.time >= fromSec - 86400 && b.time <= toSec + 86400).sort((a, b) => a.time - b.time);
  if (!bars.length) throw new Error(`${yahooSymbol}: no price history returned by Upstox`);
  return bars;
}

// ---------- quotes ----------

/** Pure: build a quote from today's 1-minute bars and the recent daily bars. */
export function quoteFromCandles(symbol: string, todayMinutes: Candle[], daily: Candle[], nowSec: number): Quote | null {
  const todayStart = Math.floor((nowSec + IST) / 86400) * 86400 - IST;
  const mins = todayMinutes.filter((c) => c.time >= todayStart);
  const priorDaily = daily.filter((d) => d.time < todayStart + 3 * 3600); // anything stamped before today's open
  const prev = priorDaily.at(-1)?.close;
  if (mins.length) {
    const price = mins.at(-1)!.close;
    const prevClose = prev ?? mins[0].open;
    return {
      symbol, price, prevClose, change: price - prevClose, changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
      dayHigh: Math.max(...mins.map((c) => c.high)), dayLow: Math.min(...mins.map((c) => c.low)), marketState: "", time: mins.at(-1)!.time, source: "upstox",
    };
  }
  // No bars today (before the open, weekend or holiday): use the last two sessions.
  if (daily.length >= 2) {
    const last = daily.at(-1)!;
    const before = daily.at(-2)!;
    return {
      symbol, price: last.close, prevClose: before.close, change: last.close - before.close, changePct: before.close ? ((last.close - before.close) / before.close) * 100 : 0,
      dayHigh: last.high, dayLow: last.low, marketState: "", time: last.time, source: "upstox",
    };
  }
  return null;
}

const istDayOf = (sec: number) => Math.floor((sec + IST) / 86400);
const sessionClose = (sec: number) => Math.floor((sec + IST) / 86400) * 86400 - IST + 15 * 3600 + 30 * 60;

/** Pure: a live quote from today's daily candle (open/high/low/latest close) and the cached previous close. */
export function quoteFromToday(symbol: string, today: Candle, prevClose: number, marketOpenNow: boolean, nowSec: number): Quote {
  const price = today.close;
  return {
    symbol, price, prevClose, change: price - prevClose, changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
    dayHigh: today.high, dayLow: today.low, marketState: "",
    // While the market is open this is "now" so the paper broker evaluates it as a fresh tick; after the close it is the session end.
    time: marketOpenNow ? nowSec : Math.min(nowSec, sessionClose(today.time)), source: "upstox",
  };
}

/** Previous session's close per instrument. It cannot change during the day, so it is fetched once per IST day. */
const prevCache = new Map<string, { day: number; close: number }>();
const prevLoading = dedupe<number | null>();

async function previousClose(key: string, nowSec: number, fetchImpl: typeof fetch): Promise<number | null> {
  const day = istDayOf(nowSec);
  const hit = prevCache.get(key);
  if (hit && hit.day === day) return hit.close;
  return prevLoading(`${key}|${day}`, async () => {
    const json = await getJson(`${BASE}/${enc(key)}/days/1/${istDate(nowSec)}/${istDate(nowSec - 10 * 86400)}`, fetchImpl);
    const bars = parseUpstoxCandles(json, "1d");
    // the last bar strictly before today's session (history normally excludes today, but be safe)
    const prev = bars.filter((b) => istDayOf(b.time) < day).at(-1);
    if (!prev) return null;
    prevCache.set(key, { day, close: prev.close });
    return prev.close;
  });
}

/**
 * Live quote in ONE request per refresh: today's daily candle carries open, high, low and the latest
 * price. The previous close is cached for the day. Before the open, or on weekends and holidays,
 * there is no candle for today, so it falls back to the last two sessions.
 */
export async function fetchUpstoxQuote(yahooSymbol: string, fetchImpl: typeof fetch = fetch): Promise<Quote> {
  const map = await getInstrumentMap(fetchImpl);
  const key = toUpstoxKey(yahooSymbol, map);
  if (!key) throw new Error(`${yahooSymbol}: not found in the Upstox instrument list`);
  const now = Math.floor(Date.now() / 1000);

  const todayJson = await getJson(`${BASE}/intraday/${enc(key)}/days/1`, fetchImpl).catch(() => null);
  const today = todayJson ? parseUpstoxCandles(todayJson, "1d").at(-1) : undefined;
  if (today && istDayOf(today.time) === istDayOf(now)) {
    const prev = await previousClose(key, now, fetchImpl);
    if (prev !== null) return quoteFromToday(yahooSymbol, today, prev, isMarketOpen(), now);
  }
  // No live candle: use the last two completed sessions.
  const dailyJson = await getJson(`${BASE}/${enc(key)}/days/1/${istDate(now)}/${istDate(now - 10 * 86400)}`, fetchImpl);
  const q = quoteFromCandles(yahooSymbol, [], parseUpstoxCandles(dailyJson, "1d"), now);
  if (!q) throw new Error(`${yahooSymbol}: could not build a quote from Upstox data`);
  return q;
}
