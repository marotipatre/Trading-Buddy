import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dedupe } from "@/lib/data/spacer";
import { buildUniverse, parseConstituents, type Constituent, type Universe } from "./universe-lists";

// Server-only loader (uses the file system for its cache). Browser code must import from "./universe-lists".
export * from "./universe-lists";

// ---------- fetching ----------

const BASE = "https://www.niftyindices.com/IndexConstituent";
const FILES = { large: "ind_nifty100list.csv", mid: "ind_niftymidcap150list.csv", small: "ind_niftysmallcap250list.csv" } as const;
const CACHE_FILE = join(tmpdir(), "trading-buddy-universe.json");
const WEEK_MS = 7 * 86_400_000;
let memo: Universe | null = null;
const loading = dedupe<Universe>();

async function download(name: string, fetchImpl: typeof fetch): Promise<Constituent[]> {
  const res = await fetchImpl(`${BASE}/${name}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`NSE Indices HTTP ${res.status} for ${name}`);
  return parseConstituents(await res.text());
}

/** The universe, cached in memory and in a temp file for a week (index membership changes twice a year). */
export async function getUniverse(fetchImpl: typeof fetch = fetch): Promise<Universe> {
  if (memo && Date.now() - memo.asOf < WEEK_MS) return memo;
  return loading("u", async () => {
    let stale: Universe | null = null;
    try {
      if (existsSync(CACHE_FILE)) {
        const u = JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Universe;
        if (u.stocks?.length > 300) {
          stale = u;
          if (Date.now() - statSync(CACHE_FILE).mtimeMs < WEEK_MS) return (memo = u);
        }
      }
    } catch {}
    try {
      const [large, mid, small] = await Promise.all([download(FILES.large, fetchImpl), download(FILES.mid, fetchImpl), download(FILES.small, fetchImpl)]);
      const stocks = buildUniverse(large, mid, small);
      if (stocks.length < 300) throw new Error("NSE constituent lists looked wrong");
      const u = { stocks, asOf: Date.now() };
      try { writeFileSync(CACHE_FILE, JSON.stringify(u)); } catch {}
      return (memo = u);
    } catch (e) {
      if (stale) return (memo = stale); // an out-of-date list is far better than none
      throw e;
    }
  });
}
