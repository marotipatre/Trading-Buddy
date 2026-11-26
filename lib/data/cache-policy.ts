import type { Interval } from "./types";
import { MAX_RANGE_DAYS } from "./yahoo";

export type CacheAction = "serve" | "serve+refresh" | "fetch";

export interface PolicyInput {
  interval: Interval;
  /** Number of cached bars in the requested window. */
  count: number;
  cachedFirst: number;
  cachedLast: number;
  fromSec: number;
  toSec: number;
  nowSec: number;
  marketOpen: boolean;
  /** When this server process last refreshed this series from the provider (unix s), if ever. */
  lastRefreshAt?: number;
}

const COVER_SLACK_SEC: Record<Interval, number> = { "1d": 6 * 86400, "15m": 3 * 86400, "5m": 3 * 86400, "1m": 2 * 86400 };

/** How long a refreshed series is trusted before a background refresh is due. */
export function refreshTtlSec(interval: Interval, marketOpen: boolean): number {
  if (marketOpen) return interval === "1d" ? 120 : 60;
  return 30 * 60;
}

/**
 * Decide how to answer a candle request:
 *  - "fetch": the cache does not cover the requested window, so we must wait for the provider.
 *  - "serve+refresh": answer from cache right now and refresh in the background.
 *  - "serve": the cache is complete and was refreshed recently.
 */
export function cacheAction(i: PolicyInput): CacheAction {
  if (i.count === 0) return "fetch";
  // The provider cannot go further back than its limit, so don't demand more than it can give.
  const effectiveFrom = Math.max(i.fromSec, i.toSec - MAX_RANGE_DAYS[i.interval] * 86400);
  if (i.cachedFirst - effectiveFrom > COVER_SLACK_SEC[i.interval]) return "fetch";
  if (i.lastRefreshAt === undefined) return "serve+refresh";
  return i.nowSec - i.lastRefreshAt > refreshTtlSec(i.interval, i.marketOpen) ? "serve+refresh" : "serve";
}
