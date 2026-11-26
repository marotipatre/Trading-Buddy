import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dedupe } from "@/lib/data/spacer";

/**
 * Stock universe with market-cap class and sector, from NSE Indices' official constituent lists:
 *   Large = Nifty 100, Mid = Nifty Midcap 150, Small = Nifty Smallcap 250 (together the Nifty 500).
 * A stock in more than one list takes the larger class. Sector is NSE's industry classification.
 */

export type Cap = "large" | "mid" | "small";
export const CAP_LABEL: Record<Cap, string> = { large: "Large cap", mid: "Mid cap", small: "Small cap" };

export interface UniverseStock { symbol: string; name: string; sector: string; cap: Cap; isin: string }
export interface Universe { stocks: UniverseStock[]; asOf: number }

export interface Constituent { name: string; industry: string; ticker: string; series: string; isin: string }

const SECTOR_NAMES: Record<string, string> = {
  "Automobile and Auto Components": "Auto",
  "Capital Goods": "Capital Goods",
  "Chemicals": "Chemicals",
  "Construction": "Construction",
  "Construction Materials": "Cement & Materials",
  "Consumer Durables": "Consumer Durables",
  "Consumer Services": "Consumer Services",
  "Diversified": "Diversified",
  "Fast Moving Consumer Goods": "FMCG",
  "Financial Services": "Financials",
  "Forest Materials": "Paper & Forest",
  "Healthcare": "Healthcare",
  "Information Technology": "IT",
  "Media Entertainment & Publication": "Media",
  "Metals & Mining": "Metals & Mining",
  "Oil Gas & Consumable Fuels": "Oil & Gas",
  "Power": "Power",
  "Realty": "Realty",
  "Services": "Services",
  "Telecommunication": "Telecom",
  "Textiles": "Textiles",
};

export function normalizeSector(industry: string): string {
  const t = industry.trim();
  return SECTOR_NAMES[t] ?? (t || "Other");
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

/** Pure: parse one NSE constituent CSV (Company Name, Industry, Symbol, Series, ISIN Code). */
export function parseConstituents(csv: string): Constituent[] {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (name: string) => header.findIndex((h) => h.includes(name));
  const [iName, iInd, iSym, iSer, iIsin] = [col("company"), col("industry"), col("symbol"), col("series"), col("isin")];
  if (iSym < 0) return [];
  const out: Constituent[] = [];
  for (const line of lines.slice(1)) {
    const c = splitCsvLine(line);
    const ticker = (c[iSym] ?? "").toUpperCase();
    if (!/^[A-Z0-9&_-]+$/.test(ticker)) continue; // skips blanks and the odd "DUMMY..." rows
    out.push({ name: c[iName] ?? ticker, industry: c[iInd] ?? "", ticker, series: c[iSer] ?? "EQ", isin: c[iIsin] ?? "" });
  }
  return out;
}

const tidyName = (n: string) => n.replace(/\s+/g, " ").replace(/\s*(Ltd|Limited)\.?$/i, "").trim();

/** Pure: merge the three lists. A stock keeps the largest class it appears in. */
export function buildUniverse(large: Constituent[], mid: Constituent[], small: Constituent[]): UniverseStock[] {
  const seen = new Set<string>();
  const out: UniverseStock[] = [];
  for (const [cap, list] of [["large", large], ["mid", mid], ["small", small]] as const) {
    for (const c of list) {
      if (seen.has(c.ticker)) continue;
      seen.add(c.ticker);
      out.push({ symbol: `${c.ticker}.NS`, name: tidyName(c.name), sector: normalizeSector(c.industry), cap, isin: c.isin });
    }
  }
  return out;
}

export function sectorsOf(stocks: UniverseStock[]): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const s of stocks) m.set(s.sector, (m.get(s.sector) ?? 0) + 1);
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export interface UniverseFilter { cap?: Cap | "all"; sector?: string | "all"; q?: string }

/** Pure: filter by class, sector and a text search over ticker and name. */
export function filterUniverse(stocks: UniverseStock[], f: UniverseFilter): UniverseStock[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return stocks.filter((s) =>
    (!f.cap || f.cap === "all" || s.cap === f.cap) &&
    (!f.sector || f.sector === "all" || s.sector === f.sector) &&
    (!q || s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)),
  );
}

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
