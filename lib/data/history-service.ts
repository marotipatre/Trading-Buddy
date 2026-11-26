import type { Candle, Interval } from "./types";

export interface HistoryProvider {
  name: "moneycontrol" | "yahoo";
  supports: (symbol: string) => boolean;
  fetch: (symbol: string, interval: Interval, fromSec: number, toSec: number) => Promise<Candle[]>;
}

export interface HistoryResult { candles: Candle[]; source: HistoryProvider["name"] }

/**
 * Price history from several providers with failover. Providers that support the symbol are tried
 * healthy-first; one that just failed is parked (tried last) for `cooldownMs`. An empty answer counts as a failure.
 */
export function createHistoryService({ providers, cooldownMs = 60_000, now = Date.now }: {
  providers: HistoryProvider[];
  cooldownMs?: number;
  now?: () => number;
}) {
  const downUntil = new Map<string, number>();
  return {
    async get(symbol: string, interval: Interval, fromSec: number, toSec: number): Promise<HistoryResult> {
      const usable = providers.filter((p) => p.supports(symbol));
      if (!usable.length) throw new Error(`${symbol}: no data source supports this symbol`);
      const t = now();
      const ordered = [
        ...usable.filter((p) => (downUntil.get(p.name) ?? 0) <= t),
        ...usable.filter((p) => (downUntil.get(p.name) ?? 0) > t),
      ];
      const errors: string[] = [];
      for (const p of ordered) {
        try {
          const candles = await p.fetch(symbol, interval, fromSec, toSec);
          if (!candles.length) throw new Error("empty response");
          downUntil.delete(p.name);
          return { candles, source: p.name };
        } catch (e) {
          downUntil.set(p.name, now() + cooldownMs);
          errors.push(`${p.name}: ${(e as Error).message}`);
        }
      }
      throw new Error(`Price history unavailable (${errors.join("; ")})`);
    },
    status: () => Object.fromEntries(providers.map((p) => [p.name, (downUntil.get(p.name) ?? 0) > now() ? "cooling-down" : "ok"])),
  };
}
