import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dedupe } from "@/lib/data/spacer";
import { getInstruments } from "@/lib/instruments";
import { applyLists, buildUniverse, mergeListed, parseConstituents, type Constituent, type Listed, type Universe } from "./universe-lists";

// Server-only loader (uses the file system for its cache). Browser code must import from "./universe-lists".
export * from "./universe-lists";

// ---------- fetching ----------

const BASE = "https://www.niftyindices.com/IndexConstituent";
const FILES = { large: "ind_nifty100list.csv", mid: "ind_niftymidcap150list.csv", small: "ind_niftysmallcap250list.csv", micro: "ind_niftymicrocap250_list.csv", n50: "ind_nifty50list.csv", n500: "ind_nifty500list.csv", m30: "ind_nifty200Momentum30_list.csv" } as const;
const CACHE_FILE = join(tmpdir(), "trading-buddy-universe-v6.json");
const WEEK_MS = 7 * 86_400_000;
let memo: Universe | null = null;
const loading = dedupe<Universe>();

async function download(name: string, fetchImpl: typeof fetch, attempt = 0): Promise<Constituent[]> {
  try { return await downloadOnce(name, fetchImpl); } catch (e) { if (attempt >= 2) throw e; await new Promise((r) => setTimeout(r, 600 * (attempt + 1))); return download(name, fetchImpl, attempt + 1); }
}

async function downloadOnce(name: string, fetchImpl: typeof fetch): Promise<Constituent[]> {
  const res = await fetchImpl(`${BASE}/${name}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`NSE Indices HTTP ${res.status} for ${name}`);
  return parseConstituents(await res.text());
}

/** The universe, cached in memory and in a temp file for a week (index membership changes twice a year). */
export async function getUniverse(fetchImpl: typeof fetch = fetch, opts: { cacheFile?: string | null; listed?: Listed[] } = {}): Promise<Universe> {
  const cacheFile = opts.cacheFile === undefined ? CACHE_FILE : opts.cacheFile; // null disables the on-disk cache (tests)
  if (opts.cacheFile === undefined && memo && Date.now() - memo.asOf < WEEK_MS) return memo;
  return loading("u", async () => {
    let stale: Universe | null = null;
    try {
      if (cacheFile && existsSync(cacheFile)) {
        const u = JSON.parse(readFileSync(cacheFile, "utf8")) as Universe;
        if (u.stocks?.length > 300) {
          stale = u;
          if (Date.now() - statSync(cacheFile).mtimeMs < WEEK_MS) return (memo = u);
        }
      }
    } catch {}
    try {
      const [large, mid, small, micro] = await Promise.all([download(FILES.large, fetchImpl), download(FILES.mid, fetchImpl), download(FILES.small, fetchImpl), download(FILES.micro, fetchImpl).catch(() => [] as Constituent[])]); // micro is a bonus: its failure must not break the core list
      let stocks = buildUniverse(large, mid, small, micro);
      const none = () => [] as Constituent[];
      const [n50, n500, m30] = await Promise.all([download(FILES.n50, fetchImpl).catch(none), download(FILES.n500, fetchImpl).catch(none), download(FILES.m30, fetchImpl).catch(none)]);
      stocks = applyLists(stocks, { n50, n500, m30 });
      if (stocks.length < 300) throw new Error("NSE constituent lists looked wrong");
      // Every other NSE stock (mainboard and SME), so the whole listed market is available everywhere in the app.
      try {
        const listed = opts.listed ?? (opts.cacheFile !== undefined ? [] : (await getInstruments())).filter((i) => i.kind === "stock" && i.exchange === "NSE").map((i) => ({ symbol: i.symbol, name: i.name, series: i.series, isin: i.isin }));
        stocks = mergeListed(stocks, listed);
      } catch { /* the Nifty lists alone are still a usable universe */ }
      const u = { stocks, asOf: Date.now() };
      try { if (cacheFile) writeFileSync(cacheFile, JSON.stringify(u)); } catch {}
      return opts.cacheFile === undefined ? (memo = u) : u;
    } catch (e) {
      if (stale) return opts.cacheFile === undefined ? (memo = stale) : stale; // an out-of-date list is far better than none
      throw e;
    }
  });
}
