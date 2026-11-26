import { getAllEquities } from "./nse-mcp";
import { parseMarket, type MarketRow } from "@/lib/multibagger/market";
import { dedupe } from "./spacer";

export interface MarketFeed { rows: MarketRow[]; updatedAt?: string; stale?: boolean }
let cache: { at: number; feed: MarketFeed } | null = null;
const loading = dedupe<MarketFeed>();
const TTL = 5 * 60_000;

/** Every listed NSE equity (mainboard and SME) from NSE's official live MCP feed, shared by every caller for five minutes. */
export function loadMarketFeed(): Promise<MarketFeed> {
  if (cache && Date.now() - cache.at < TTL) return Promise.resolve(cache.feed);
  return loading("feed", async () => {
    try {
      const [main, sme] = await Promise.all([getAllEquities(), getAllEquities(undefined, "cm_get_sme_stocks").catch(() => ({ stocks: [] as Record<string, unknown>[], updatedAt: undefined }))]);
      const rows = [...parseMarket(main), ...parseMarket(sme, "sme")];
      if (rows.length < 500) throw new Error("NSE returned too few stocks");
      const feed = { rows, updatedAt: main.updatedAt };
      cache = { at: Date.now(), feed };
      return feed;
    } catch (e) {
      if (cache) return { ...cache.feed, stale: true };
      throw e;
    }
  });
}
