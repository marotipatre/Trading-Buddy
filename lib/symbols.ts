import { INDICES, POPULAR_STOCKS } from "./universe";

export type Exchange = "NSE" | "BSE" | "INDEX";

const KNOWN_NAMES = new Map<string, string>([...INDICES, ...POPULAR_STOCKS].map((i) => [i.symbol, i.name]));

const INDEX_LABEL: Record<string, string> = { "^NSEI": "NIFTY 50", "^NSEBANK": "BANK NIFTY", "^BSESN": "SENSEX", "^CNXIT": "NIFTY IT", "^INDIAVIX": "INDIA VIX" };

/** "RELIANCE.NS" -> "RELIANCE", "^NSEBANK" -> "BANK NIFTY": how brokers label a symbol. */
export function displaySymbol(yahoo: string): string {
  const s = yahoo.trim();
  if (INDEX_LABEL[s.toUpperCase()]) return INDEX_LABEL[s.toUpperCase()];
  // other indices are stored as ^NIFTY_REALTY; show them the way a broker would: NIFTY REALTY
  if (s.startsWith("^")) return s.slice(1).replace(/_/g, " ");
  return s.replace(/\.(NS|BO)$/i, "");
}

export function exchangeOf(yahoo: string): Exchange {
  const s = yahoo.trim().toUpperCase();
  if (s.startsWith("^")) return "INDEX";
  return s.endsWith(".BO") ? "BSE" : "NSE";
}

/** Convert what a user types or a broker shows ("reliance", "RELIANCE NSE") into the data-provider symbol. */
export function toProviderSymbol(input: string, exchange: Exchange = "NSE"): string {
  const s = input.trim().toUpperCase();
  const idx = Object.entries(INDEX_LABEL).find(([, label]) => label === s);
  if (idx) return idx[0];
  if (s.startsWith("^") || /\.(NS|BO)$/.test(s)) return s;
  return `${s}${exchange === "BSE" ? ".BO" : ".NS"}`;
}

const learned = new Map<string, string>();

/** Remember a company name seen in search results so every screen can show it. */
export function rememberName(yahoo: string, name?: string | null) {
  if (name && name.trim() && name.trim().toUpperCase() !== displaySymbol(yahoo).toUpperCase()) learned.set(yahoo.toUpperCase(), name.trim());
}

export function companyName(yahoo: string): string | undefined {
  const key = yahoo.toUpperCase();
  return learned.get(key) ?? KNOWN_NAMES.get(yahoo) ?? KNOWN_NAMES.get(key);
}

/** Title-case search-result names that arrive in capitals, e.g. "RELIANCE INDUSTRIES LTD". */
export function tidyName(name: string): string {
  const small = new Set(["of", "and", "the", "&", "ltd", "ltd.", "limited"]);
  if (name !== name.toUpperCase()) return name;
  return name.toLowerCase().split(/\s+/).map((w, i) => (i > 0 && small.has(w) && w !== "ltd" && w !== "ltd." && w !== "limited" ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
}
