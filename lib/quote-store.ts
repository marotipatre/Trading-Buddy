import type { Quote } from "@/lib/data/types";

const KEY = "trading-buddy:last-quotes:v1";
const MAX = 120;

type Stored = Record<string, Quote>;

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? (v as Stored) : {};
  } catch {
    return {};
  }
}

/** Last known quotes for these symbols, from the previous session. */
export function loadLastQuotes(symbols: string[]): Record<string, Quote> {
  const all = read();
  const out: Record<string, Quote> = {};
  for (const s of symbols) {
    const q = all[s];
    if (q && typeof q.price === "number" && Number.isFinite(q.price)) out[s] = q;
  }
  return out;
}

export function saveLastQuotes(quotes: Quote[]) {
  if (!quotes.length) return;
  try {
    const all = read();
    for (const q of quotes) all[q.symbol] = q;
    const keys = Object.keys(all);
    // keep the newest entries by quote time when over the cap
    if (keys.length > MAX) keys.sort((a, b) => (all[b].time ?? 0) - (all[a].time ?? 0)).slice(MAX).forEach((k) => delete all[k]);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}
