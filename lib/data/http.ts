export interface RetryOptions {
  /** Hosts tried round-robin so a throttled one can be skipped. */
  hosts: string[];
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

export function parseRetryAfter(v: string | null, now = Date.now()): number | null {
  if (!v) return null;
  const secs = Number(v);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(v);
  return Number.isFinite(when) ? Math.max(0, when - now) : null;
}

/** GET JSON with exponential backoff + jitter on throttling and transient errors. */
export async function getJsonWithRetry<T = unknown>(path: string, opts: RetryOptions): Promise<T> {
  const {
    hosts, retries = 4, baseDelayMs = 500, maxDelayMs = 8000, headers,
    fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), random = Math.random,
  } = opts;
  let lastErr: Error = new Error("request failed");
  for (let attempt = 0; attempt <= retries; attempt++) {
    const host = hosts[attempt % hosts.length];
    let retryAfter: number | null = null;
    try {
      const res = await fetchImpl(host + path, { headers, cache: "no-store" });
      if (res.ok) return (await res.json()) as T;
      lastErr = new Error(`HTTP ${res.status} from ${new URL(host).hostname}`);
      if (!RETRYABLE.has(res.status)) throw Object.assign(lastErr, { fatal: true });
      retryAfter = parseRetryAfter(res.headers.get("retry-after"));
    } catch (e) {
      if ((e as { fatal?: boolean }).fatal) throw e;
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
    if (attempt === retries) break;
    const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
    const delay = Math.min(maxDelayMs, retryAfter ?? backoff * (0.5 + random() * 0.5));
    await sleep(delay);
  }
  throw lastErr;
}
