/**
 * A small in-memory limiter: at most `limit` calls per `windowMs` for each key (use the signed-in user's id).
 * It protects the free data sources behind this app from being hammered by one account. It lives in one server
 * process, which is right for a personal or small shared deployment; use a shared store if you scale out.
 */
const buckets = new Map<string, { start: number; count: number }>();

export function allow(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  const b = buckets.get(key);
  if (!b || now - b.start >= windowMs) {
    buckets.set(key, { start: now, count: 1 });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.start >= windowMs) buckets.delete(k);
    return { ok: true, retryAfterSec: 0 };
  }
  if (b.count < limit) { b.count++; return { ok: true, retryAfterSec: 0 }; }
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.start + windowMs - now) / 1000)) };
}

export const _resetForTests = () => buckets.clear();
