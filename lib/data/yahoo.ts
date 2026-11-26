/* eslint-disable @typescript-eslint/no-explicit-any -- untyped Yahoo JSON */
import { getJsonWithRetry } from "./http";
import { prevCloseFromDaily } from "./prev-close";
import { createSpacer, dedupe } from "./spacer";
import type { Candle, Interval, Quote, SymbolHit } from "./types";

// Unofficial Yahoo Finance endpoints. Server-side only.
const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  Accept: "application/json",
};

// All Yahoo traffic goes through one queue (>= 350 ms between requests) and identical
// concurrent requests share one call, so we never burst into a rate limit.
const spaced = createSpacer({ minGapMs: 350 });
const shared = dedupe<any>();

/** `fast` fails quickly (for live quotes, where a fallback source exists); history waits longer. */
function yget(path: string, opts: { fast?: boolean } = {}): Promise<any> {
  return shared(`${opts.fast ? "f" : "s"}:${path}`, () =>
    spaced(() =>
      getJsonWithRetry(path, opts.fast
        ? { hosts: HOSTS, headers: HEADERS, retries: 1, baseDelayMs: 300 }
        : { hosts: HOSTS, headers: HEADERS, retries: 4, baseDelayMs: 800, maxDelayMs: 6000 }),
    ),
  );
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

/** One live quote from Yahoo's chart metadata (no crumb/cookie needed). */
export async function fetchYahooQuote(symbol: string): Promise<Quote> {
  // Daily bars give a reliable previous close; chartPreviousClose is just the close before the range starts.
  const json = await yget(`/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`, { fast: true });
  const r = json?.chart?.result?.[0];
  const m = r?.meta;
  if (!m || typeof m.regularMarketPrice !== "number") throw new Error(`${symbol}: no price from Yahoo`);
  const price = m.regularMarketPrice as number;
  const prev = prevCloseFromDaily(r.timestamp ?? [], r.indicators?.quote?.[0]?.close ?? [], m.regularMarketTime ?? Math.floor(Date.now() / 1000));
  if (prev === undefined) throw new Error(`${symbol}: could not determine the previous close from Yahoo`);
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
    source: "yahoo",
  };
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
