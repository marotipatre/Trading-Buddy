export interface SpacerOptions {
  /** Minimum gap between the START of consecutive tasks. */
  minGapMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Runs tasks one at a time with a minimum gap between starts. Keeps bursts of requests from
 * tripping an upstream rate limiter. A failing task never blocks the queue.
 */
export function createSpacer({ minGapMs, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }: SpacerOptions) {
  let tail: Promise<unknown> = Promise.resolve();
  let lastStart = -Infinity;
  return function run<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(async () => {
      const wait = lastStart + minGapMs - now();
      if (wait > 0) await sleep(wait);
      lastStart = now();
      return task();
    });
    tail = result.catch(() => undefined);
    return result;
  };
}

/** Share one in-flight promise between identical concurrent calls. */
export function dedupe<T>() {
  const inflight = new Map<string, Promise<T>>();
  return (key: string, make: () => Promise<T>): Promise<T> => {
    const hit = inflight.get(key);
    if (hit) return hit;
    const p = make().finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  };
}
