import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dedupe } from "@/lib/data/spacer";
import { tidyName } from "@/lib/symbols";

/**
 * Every listed instrument we can price: NSE and BSE equities (main board and SME) plus NSE and BSE
 * indices, from Upstox's public instrument lists. Bonds, government securities and derivatives are left out.
 * `symbol` is what the rest of the app uses: RELIANCE.NS, RELIANCE.BO, ^NSEI.
 */

export type InstrumentKind = "stock" | "index";
export interface Instrument {
  symbol: string;
  name: string;
  exchange: "NSE" | "BSE";
  kind: InstrumentKind;
  /** Series / group, e.g. EQ, SM (SME), A, B. */
  series: string;
  /** Upstox instrument key used to fetch candles. */
  key: string;
  isin?: string;
}

export interface Row { segment?: string; instrument_type?: string; trading_symbol?: string; instrument_key?: string; name?: string; isin?: string }

// Tradeable equity series. Excluded: SG/GS/GB/TB (government securities), N*/Y*/Z* (bonds and debentures), F/G (BSE debt).
const NSE_STOCK_SERIES = new Set(["EQ", "BE", "BZ", "SM", "ST", "IV", "RR"]);
const BSE_STOCK_GROUPS = new Set(["A", "B", "T", "X", "XT", "Z", "M", "MT", "MS", "TS"]);

/** The classic Yahoo-style symbols for the main indices, so existing screens keep working. */
export const KNOWN_INDEX_SYMBOLS: Record<string, string> = {
  "NSE_INDEX|Nifty 50": "^NSEI",
  "NSE_INDEX|Nifty Bank": "^NSEBANK",
  "NSE_INDEX|Nifty IT": "^CNXIT",
  "NSE_INDEX|India VIX": "^INDIAVIX",
  "BSE_INDEX|SENSEX": "^BSESN",
};

const indexSymbol = (key: string, name: string) => KNOWN_INDEX_SYMBOLS[key] ?? `^${name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`;

/** Pure: build the instrument list from the two raw Upstox files. */
export function buildInstruments(nse: Row[], bse: Row[]): Instrument[] {
  const out = new Map<string, Instrument>();
  const add = (i: Instrument) => {
    const prev = out.get(i.symbol);
    // if a symbol appears in two series, keep the main one (EQ / A)
    if (!prev || (i.series === "EQ" && prev.series !== "EQ")) out.set(i.symbol, i);
  };
  for (const r of nse) {
    if (!r.trading_symbol || !r.instrument_key) continue;
    if (r.segment === "NSE_EQ" && NSE_STOCK_SERIES.has(r.instrument_type ?? "")) {
      add({ symbol: `${r.trading_symbol.toUpperCase()}.NS`, name: tidyName(r.name ?? r.trading_symbol), exchange: "NSE", kind: "stock", series: r.instrument_type!, key: r.instrument_key, isin: r.isin });
    }
  }
  for (const r of nse) {
    if (r.segment === "NSE_INDEX" && r.instrument_key && r.name) {
      add({ symbol: indexSymbol(r.instrument_key, r.name), name: r.name.trim(), exchange: "NSE", kind: "index", series: "INDEX", key: r.instrument_key });
    }
  }
  for (const r of bse) {
    if (!r.trading_symbol || !r.instrument_key) continue;
    if (r.segment === "BSE_EQ" && BSE_STOCK_GROUPS.has(r.instrument_type ?? "")) {
      add({ symbol: `${r.trading_symbol.toUpperCase()}.BO`, name: tidyName(r.name ?? r.trading_symbol), exchange: "BSE", kind: "stock", series: r.instrument_type!, key: r.instrument_key, isin: r.isin });
    } else if (r.segment === "BSE_INDEX" && r.name) {
      add({ symbol: indexSymbol(r.instrument_key, r.name), name: r.name.trim(), exchange: "BSE", kind: "index", series: "INDEX", key: r.instrument_key });
    }
  }
  return [...out.values()];
}

// ---------- search ----------

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9&]+/).filter(Boolean);
const tickerOf = (symbol: string) => symbol.replace(/^\^/, "").replace(/\.(NS|BO)$/i, "").toLowerCase();

/** Pure ranking: exact ticker > ticker prefix > name prefix > every typed word starts a word in the name > substring. */
export function scoreInstrument(i: Instrument, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = tickerOf(i.symbol).replace(/_/g, " ");
  const n = i.name.toLowerCase();
  let s = 0;
  if (t === q) s = 100;
  else if (n === q) s = 98; // e.g. "sensex" or "nifty bank" typed in full: the index itself beats ETFs that merely start with it
  else if (t.startsWith(q)) s = 85 - Math.min(20, t.length - q.length);
  else if (n.startsWith(q)) s = 75;
  else {
    const qw = words(q);
    const nw = words(n);
    if (qw.length > 1 && qw.every((w) => nw.some((x) => x.startsWith(w)) || t.startsWith(w))) s = 60;
    else if (qw.length === 1 && nw.some((x) => x.startsWith(qw[0]))) s = 55;
    else if (t.includes(q)) s = 40;
    else if (n.includes(q)) s = 30;
  }
  if (s === 0) return 0;
  // Prefer the NSE listing, main-board series and indices over SME, and shorter names on ties.
  return s + (i.exchange === "NSE" ? 4 : 0) + (i.series === "EQ" || i.series === "A" || i.kind === "index" ? 2 : 0);
}

/**
 * Ranked search. `boost` lists symbols that should win ties against obscure look-alikes
 * (for example the Nifty 500), so "bajaj" shows Bajaj Finance and Bajaj Auto before tiny tickers.
 */
export function searchInstruments(list: Instrument[], query: string, limit = 12, boost?: ReadonlySet<string>): Instrument[] {
  if (!query.trim()) return [];
  return list
    .map((i) => ({ i, s: scoreInstrument(i, query) }))
    .filter((x) => x.s > 0)
    .map((x) => (boost?.has(x.i.symbol) ? { ...x, s: x.s + 12 } : x))
    .sort((a, b) => b.s - a.s || a.i.name.length - b.i.name.length || a.i.symbol.localeCompare(b.i.symbol))
    .slice(0, limit)
    .map((x) => x.i);
}

// ---------- loading ----------

const URLS = { nse: "https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz", bse: "https://assets.upstox.com/market-quote/instruments/exchange/BSE.json.gz" };
const CACHE_FILE = join(tmpdir(), "trading-buddy-instruments-v2.json");
const DAY_MS = 86_400_000;
let memo: { list: Instrument[]; at: number } | null = null;
const loading = dedupe<Instrument[]>();

async function download(url: string, fetchImpl: typeof fetch): Promise<Row[]> {
  const res = await fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Upstox instrument list HTTP ${res.status}`);
  return JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8")) as Row[];
}

/** All instruments, cached in memory and in a temp file for a day (the raw files are ~3 MB gzipped, ~70 MB of JSON). */
export async function getInstruments(fetchImpl: typeof fetch = fetch): Promise<Instrument[]> {
  if (memo && Date.now() - memo.at < DAY_MS) return memo.list;
  return loading("all", async () => {
    let stale: Instrument[] | null = null;
    try {
      if (existsSync(CACHE_FILE)) {
        const list = JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Instrument[];
        if (list.length > 2000) {
          stale = list;
          if (Date.now() - statSync(CACHE_FILE).mtimeMs < DAY_MS) return (memo = { list, at: Date.now() }).list;
        }
      }
    } catch {}
    try {
      const [nse, bse] = await Promise.all([download(URLS.nse, fetchImpl), download(URLS.bse, fetchImpl).catch(() => [] as Row[])]);
      const list = buildInstruments(nse, bse);
      if (list.length < 2000) throw new Error("Upstox instrument list looked wrong");
      try { writeFileSync(CACHE_FILE, JSON.stringify(list)); } catch {}
      return (memo = { list, at: Date.now() }).list;
    } catch (e) {
      if (stale) return (memo = { list: stale, at: Date.now() }).list;
      throw e;
    }
  });
}

/** symbol (upper-case) -> Upstox key, for every instrument. */
export async function getInstrumentKeyMap(fetchImpl: typeof fetch = fetch): Promise<Record<string, string>> {
  const m: Record<string, string> = {};
  for (const i of await getInstruments(fetchImpl)) m[i.symbol.toUpperCase()] = i.key;
  return m;
}
