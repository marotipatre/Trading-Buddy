import { getAllEquities, getBulkQuotes } from "./nse-mcp";
import { getUniverse } from "@/lib/universe-data";
import { parseMarket, type MarketRow } from "@/lib/multibagger/market";
import { dedupe } from "./spacer";

export interface MarketFeed { rows: MarketRow[]; updatedAt?: string; stale?: boolean; /** True when only the end-of-day backup was available: no 52-week range or 30-day change. */ fallback?: boolean }
let cache: { at: number; feed: MarketFeed } | null = null;
const loading = dedupe<MarketFeed>();
const TTL = 5 * 60_000;

/**
 * Backup when the live feed refuses this host: the same market from NSE's end-of-day server, 50 symbols per call.
 * It has the last official close, change and volume, but not the 52-week range or the 30-day change, so those come back empty.
 */
async function fromEndOfDay(): Promise<MarketFeed> {
  const u = await getUniverse();
  const bySym = new Map(u.stocks.map((s) => [s.symbol.replace(/\.NS$/, ""), s]));
  const chunks: string[][] = [];
  const syms = [...bySym.keys()];
  for (let i = 0; i < syms.length; i += 50) chunks.push(syms.slice(i, i + 50));
  const rows: MarketRow[] = [];
  const queue = [...chunks];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let c = queue.shift(); c !== undefined; c = queue.shift()) {
      try {
        for (const q of await getBulkQuotes(c)) {
          if (!(q.close > 0)) continue;
          const sme = bySym.get(q.symbol)?.cap === "sme";
          rows.push({ symbol: q.symbol, series: sme ? "SM" : "EQ", segment: sme ? "sme" : "main", price: q.close, prevClose: q.prev_close, chgPct: q.pct_change ?? (q.prev_close ? (q.close / q.prev_close - 1) * 100 : 0), volume: q.volume, valueCr: (q.close * q.volume) / 1e7, high52: 0, low52: 0, chg30d: null });
        }
      } catch { /* those stocks are simply missing */ }
    }
  }));
  if (rows.length < 500) throw new Error("the end-of-day feed returned too few stocks");
  return { rows, updatedAt: undefined, fallback: true };
}

/** Every listed NSE equity (mainboard and SME) from NSE's official MCP feed, shared by every caller for five minutes. */
export function loadMarketFeed(): Promise<MarketFeed> {
  if (cache && Date.now() - cache.at < TTL) return Promise.resolve(cache.feed);
  return loading("feed", async () => {
    try {
      const [main, sme] = await Promise.all([getAllEquities(), getAllEquities(undefined, "cm_get_sme_stocks").catch(() => ({ stocks: [] as Record<string, unknown>[], updatedAt: undefined }))]);
      const rows = [...parseMarket(main), ...parseMarket(sme, "sme")];
      if (rows.length < 500) throw new Error("NSE returned too few stocks");
      const feed: MarketFeed = { rows, updatedAt: main.updatedAt };
      cache = { at: Date.now(), feed };
      return feed;
    } catch (liveError) {
      try {
        const feed = await fromEndOfDay();
        cache = { at: Date.now() - TTL + 60_000, feed }; // try the live feed again in a minute
        return feed;
      } catch {
        if (cache) return { ...cache.feed, stale: true };
        throw liveError;
      }
    }
  });
}
