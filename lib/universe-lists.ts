
/**
 * Pure helpers for the stock universe (safe to import from browser code; no Node APIs).
 * Market-cap class and sector come from NSE Indices' official constituent lists:
 *   Large = Nifty 100, Mid = Nifty Midcap 150, Small = Nifty Smallcap 250 (together the Nifty 500), Micro = Nifty Microcap 250 (thinly traded, the riskiest).
 * A stock in more than one list takes the larger class. Sector is NSE's industry classification.
 */

export type Cap = "large" | "mid" | "small" | "micro" | "other" | "sme";
/** Largest to smallest; "other" is any mainboard stock outside the Nifty lists, "sme" is NSE's SME platform. */
export const CAP_ORDER: Cap[] = ["large", "mid", "small", "micro", "other", "sme"];
export const CAP_LABEL: Record<Cap, string> = { large: "Large cap", mid: "Mid cap", small: "Small cap", micro: "Micro cap", other: "Other listed", sme: "SME" };
export const CAP_SHORT: Record<Cap, string> = { large: "Large", mid: "Mid", small: "Small", micro: "Micro", other: "Other", sme: "SME" };
/** Classes too thin or too small for the app to build a plan or portfolio around; they are still shown and scored. */
export const THIN_CAPS: Cap[] = ["micro", "other", "sme"];

/** Index lists a stock belongs to, for choosing what to scan. */
export type ScanList = "n50" | "n200" | "n500" | "m30";
export interface UniverseStock { symbol: string; name: string; sector: string; cap: Cap; isin: string; lists?: ScanList[] }
export type ScanScope = "n50" | "n200" | "n500" | "mid" | "small" | "m30" | "all";
export const SCAN_SCOPES: { id: ScanScope; label: string; hint: string }[] = [
  { id: "n50", label: "Nifty 50", hint: "The 50 largest companies. Fastest." },
  { id: "n200", label: "Nifty 200", hint: "The 200 largest companies: large caps plus the top of the mid caps." },
  { id: "n500", label: "Nifty 500", hint: "The 500 biggest listed companies. The usual choice." },
  { id: "mid", label: "Midcap 150", hint: "NSE's Nifty Midcap 150: the 150 companies just below the Nifty 100." },
  { id: "small", label: "Smallcap 250", hint: "NSE's Nifty Smallcap 250: smaller companies, more movement, thinner trading." },
  { id: "m30", label: "Nifty 200 Momentum 30", hint: "NSE's 30 strongest-momentum stocks from the Nifty 200." },
  { id: "all", label: "All NSE stocks", hint: "Every listed stock that trades (about 2,300). Slow the first time." },
];
export const inScope = (s: Pick<UniverseStock, "lists" | "cap">, scope: ScanScope): boolean => scope === "all" || (scope === "mid" || scope === "small" ? s.cap === scope : (s.lists ?? []).includes(scope));
/** True when everything in `want` is also covered by a scan that used `have`. */
export const scopeCovers = (have: ScanScope, want: ScanScope): boolean => have === want || have === "all" || (have === "n500" && want !== "all") || (have === "n200" && (want === "n50" || want === "m30"));
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
export function buildUniverse(large: Constituent[], mid: Constituent[], small: Constituent[], micro: Constituent[] = []): UniverseStock[] {
  const seen = new Set<string>();
  const out: UniverseStock[] = [];
  for (const [cap, list] of [["large", large], ["mid", mid], ["small", small], ["micro", micro]] as const) {
    for (const c of list) {
      if (seen.has(c.ticker)) continue;
      seen.add(c.ticker);
      out.push({ symbol: `${c.ticker}.NS`, name: tidyName(c.name), sector: normalizeSector(c.industry), cap, isin: c.isin });
    }
  }
  return out;
}

/** Pure: tag stocks with the index lists they belong to. */
export function applyLists(stocks: UniverseStock[], lists: Partial<Record<ScanList, Constituent[]>>): UniverseStock[] {
  const by = new Map<string, ScanList[]>();
  for (const k of ["n50", "n200", "n500", "m30"] as ScanList[]) for (const c of lists[k] ?? []) { const sym = `${c.ticker}.NS`; by.set(sym, [...(by.get(sym) ?? []), k]); }
  return stocks.map((s) => (by.has(s.symbol) ? { ...s, lists: by.get(s.symbol) } : s));
}

/** One listed NSE stock from the exchange's instrument list. */
export interface Listed { symbol: string; name: string; series: string; isin?: string }
const FUND_LIKE = /(BEES|ETF|IETF|LIQUID|GILT|NIFTY|SENSEX|BANKEX|MON100|MOM100|MAFANG|\bFUND\b|INDEX FUND|MUTUAL|AMC\s*-|\bMF\s*-)/i;

/** Pure: add every other NSE stock (not in the Nifty lists) so the whole listed market is browsable. ETFs and funds are left out. */
export function mergeListed(stocks: UniverseStock[], listed: Listed[]): UniverseStock[] {
  const have = new Set(stocks.map((s) => s.symbol));
  const extra: UniverseStock[] = [];
  for (const l of listed) {
    if (have.has(l.symbol) || FUND_LIKE.test(l.symbol) || FUND_LIKE.test(l.name)) continue;
    have.add(l.symbol);
    extra.push({ symbol: l.symbol, name: l.name, sector: "Unclassified", cap: l.series === "SM" || l.series === "ST" ? "sme" : "other", isin: l.isin ?? "" });
  }
  extra.sort((a, b) => a.name.localeCompare(b.name));
  return [...stocks, ...extra];
}

export function sectorsOf(stocks: UniverseStock[]): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const s of stocks) m.set(s.sector, (m.get(s.sector) ?? 0) + 1);
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** `cap` is a size class (large, mid, ...) or an index choice (n50, n200, n500, m30, mid, small), or "all". */
export interface UniverseFilter { cap?: Cap | ScanScope; sector?: string | "all"; q?: string }

/** Pure: filter by class, sector and a text search over ticker and name. */
export function filterUniverse(stocks: UniverseStock[], f: UniverseFilter): UniverseStock[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return stocks.filter((s) =>
    (!f.cap || f.cap === "all" || ((CAP_ORDER as string[]).includes(f.cap) ? s.cap === f.cap : inScope(s, f.cap as ScanScope))) &&
    (!f.sector || f.sector === "all" || s.sector === f.sector) &&
    (!q || s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)),
  );
}
