/* eslint-disable @typescript-eslint/no-explicit-any -- untyped Yahoo JSON */
import type { Candle, Interval, Quote, SymbolHit } from "./types";

// Unofficial Yahoo Finance endpoints. Server-side only.
const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  Accept: "application/json",
};

async function yget(path: string): Promise<any> {
  let lastErr: unknown;
  for (const host of HOSTS) {
    try {
      const res = await fetch(host + path, { headers: HEADERS, cache: "no-store" });
      if (res.ok) return await res.json();
      lastErr = new Error(`Yahoo ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Yahoo request failed");
}

/** Max history Yahoo serves per interval (days). */
export const MAX_RANGE_DAYS: Record<Interval, number> = {
  "1d": 365 * 20,
  "15m": 59,
  "5m": 59,
  "1m": 7,
};

export async function fetchCandles(
  symbol: string,
  interval: Interval,
  fromSec: number,
  toSec: number,
): Promise<Candle[]> {
  const minFrom = toSec - MAX_RANGE_DAYS[interval] * 86400;
  const period1 = Math.max(fromSec, minFrom);
  const json = await yget(
    `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&period1=${Math.floor(period1)}&period2=${Math.floor(toSec)}&includeAdjustedClose=true`,
  );
  const r = json?.chart?.result?.[0];
  if (!r?.timestamp) {
    const msg = json?.chart?.error?.description ?? "No data";
    throw new Error(`${symbol}: ${msg}`);
  }
  const q = r.indicators.quote[0];
  const adj: number[] | undefined = r.indicators.adjclose?.[0]?.adjclose;
  const out: Candle[] = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    if (q.open[i] == null || q.close[i] == null || q.high[i] == null || q.low[i] == null) continue;
    // Daily bars: back-adjust OHLC by adjclose/close for splits & dividends.
    const f = interval === "1d" && adj?.[i] != null && q.close[i] ? adj[i] / q.close[i] : 1;
    out.push({
      time: r.timestamp[i],
      open: q.open[i] * f,
      high: q.high[i] * f,
      low: q.low[i] * f,
      close: q.close[i] * f,
      volume: q.volume[i] ?? 0,
    });
  }
  return out;
}

export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  // Chart meta gives a live price without needing Yahoo's crumb/cookie dance.
  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const json = await yget(
        `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`,
      );
      const m = json?.chart?.result?.[0]?.meta;
      if (!m) throw new Error("no meta");
      const price = m.regularMarketPrice as number;
      const prev = (m.chartPreviousClose ?? m.previousClose) as number;
      return {
        symbol,
        price,
        prevClose: prev,
        change: price - prev,
        changePct: prev ? ((price - prev) / prev) * 100 : 0,
        dayHigh: m.regularMarketDayHigh ?? price,
        dayLow: m.regularMarketDayLow ?? price,
        marketState: m.marketState ?? "",
        time: m.regularMarketTime ?? 0,
      } satisfies Quote;
    }),
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
}

export async function searchSymbols(query: string): Promise<SymbolHit[]> {
  const json = await yget(
    `/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`,
  );
  return (json.quotes ?? [])
    .filter((x: any) => x.symbol && (x.exchange === "NSI" || x.exchange === "BSE" || x.symbol.startsWith("^NSE") || x.symbol === "^BSESN"))
    .map((x: any) => ({
      symbol: x.symbol,
      name: x.longname ?? x.shortname ?? x.symbol,
      exchange: x.exchange,
    }));
}
