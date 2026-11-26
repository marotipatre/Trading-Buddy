import type { Candle } from "@/lib/data/types";

/**
 * Daily candles kept in the browser's IndexedDB, so a second scan (or tomorrow's page load) does not download everything
 * again. Each series is packed into one typed array. Entries expire (see `fresh`), because yesterday's last candle is
 * not today's.
 */
const DB = "tb-candles", STORE = "series", VERSION = 1;

export interface Packed { key: string; at: number; data: Float64Array }

export function pack(candles: Candle[]): Float64Array {
  const a = new Float64Array(candles.length * 6);
  candles.forEach((c, i) => { a.set([c.time, c.open, c.high, c.low, c.close, c.volume], i * 6); });
  return a;
}
export function unpack(a: Float64Array): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i + 5 < a.length; i += 6) out.push({ time: a[i], open: a[i + 1], high: a[i + 2], low: a[i + 3], close: a[i + 4], volume: a[i + 5] });
  return out;
}

/** Fresh for 3 hours while the market could still be moving, and for a day once it has closed for the weekend or night. */
export function fresh(at: number, now: number, marketOpen: boolean): boolean {
  return now - at < (marketOpen ? 20 * 60_000 : 6 * 3600_000);
}

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: "key" }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

let dbp: Promise<IDBDatabase | null> | null = null;
const db = () => (dbp ??= open());

export async function readSeries(key: string): Promise<{ at: number; candles: Candle[] } | null> {
  const d = await db();
  if (!d) return null;
  return new Promise((resolve) => {
    try {
      const r = d.transaction(STORE, "readonly").objectStore(STORE).get(key);
      r.onsuccess = () => { const v = r.result as Packed | undefined; resolve(v ? { at: v.at, candles: unpack(v.data) } : null); };
      r.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

export async function writeSeries(key: string, candles: Candle[]): Promise<void> {
  const d = await db();
  if (!d) return;
  try { d.transaction(STORE, "readwrite").objectStore(STORE).put({ key, at: Date.now(), data: pack(candles) } satisfies Packed); } catch { /* storage full or blocked */ }
}
