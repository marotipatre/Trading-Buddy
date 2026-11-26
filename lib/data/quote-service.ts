import type { Quote } from "./types";

export interface QuoteProvider {
  name: "yahoo" | "google" | "upstox";
  fetch: (symbol: string) => Promise<Quote>;
}

export interface QuoteServiceOptions {
  providers: QuoteProvider[];
  /** Serve a cached quote without asking any provider while it is this fresh. May depend on the time (e.g. longer when the market is closed). */
  ttlMs?: number | (() => number);
  /** After a failure a provider is tried last for this long. */
  cooldownMs?: number;
  /** How many symbols are fetched at once. */
  concurrency?: number;
  now?: () => number;
}

/**
 * Live quotes from several sources with caching and a simple circuit breaker.
 * Healthy providers are tried first; a failing one is moved to the back for `cooldownMs`
 * so a throttled source does not slow every request. If every source fails the last known
 * quote is returned (marked by its original `time`) rather than a blank row.
 */
export function createQuoteService({ providers, ttlMs = 8000, cooldownMs = 60_000, concurrency = 3, now = Date.now }: QuoteServiceOptions) {
  const cache = new Map<string, { q: Quote; at: number; fallback: boolean }>();
  const downUntil = new Map<string, number>();

  const order = () => {
    const t = now();
    const healthy = providers.filter((p) => (downUntil.get(p.name) ?? 0) <= t);
    const parked = providers.filter((p) => (downUntil.get(p.name) ?? 0) > t);
    return [...healthy, ...parked];
  };

  async function one(symbol: string): Promise<Quote | null> {
    const hit = cache.get(symbol);
    // A quote that came from a fallback source is only trusted for the cooldown, so a one-off failure
    // of the primary source does not pin us to the fallback for the whole (possibly long) TTL.
    const fullTtl = typeof ttlMs === "function" ? ttlMs() : ttlMs;
    if (hit && now() - hit.at < (hit.fallback ? Math.min(fullTtl, cooldownMs) : fullTtl)) return hit.q;
    const tried = order();
    for (const p of tried) {
      try {
        const q = await p.fetch(symbol);
        downUntil.delete(p.name);
        const tagged = { ...q, source: q.source ?? p.name };
        cache.set(symbol, { q: tagged, at: now(), fallback: p !== providers[0] });
        return tagged;
      } catch {
        downUntil.set(p.name, now() + cooldownMs);
      }
    }
    return hit?.q ?? null;
  }

  return {
    async getQuotes(symbols: string[]): Promise<Quote[]> {
      const out = new Map<string, Quote>();
      for (let i = 0; i < symbols.length; i += concurrency) {
        const batch = symbols.slice(i, i + concurrency);
        const res = await Promise.all(batch.map(one));
        res.forEach((q, k) => q && out.set(batch[k], q));
      }
      return symbols.flatMap((s) => (out.has(s) ? [out.get(s)!] : []));
    },
    /** For diagnostics/tests. */
    status: () => Object.fromEntries(providers.map((p) => [p.name, (downUntil.get(p.name) ?? 0) > now() ? "cooling-down" : "ok"])),
  };
}
