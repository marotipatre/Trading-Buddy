import type { ClosedTrade, PaperState } from "./types";

/** Quick tags for reviewing your own behaviour. Free text tags are allowed too. */
export const PRESET_TAGS = [
  "Followed plan", "Early exit", "Held too long", "Moved stop", "No stop", "FOMO", "Revenge trade", "Oversized", "News/event", "Good setup",
] as const;

export function normalizeTags(input: string[] | string): string[] {
  const list = Array.isArray(input) ? input : input.split(",");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const t = raw.trim().replace(/\s+/g, " ").slice(0, 30);
    const key = t.toLowerCase();
    if (t && !seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out.slice(0, 8);
}

export function annotateTrade(state: PaperState, tradeId: number, patch: { note?: string; tags?: string[] }): PaperState {
  return {
    ...state,
    trades: state.trades.map((t): ClosedTrade =>
      t.id !== tradeId ? t : {
        ...t,
        ...(patch.note !== undefined ? { note: patch.note.slice(0, 2000) } : {}),
        ...(patch.tags !== undefined ? { tags: normalizeTags(patch.tags) } : {}),
      }),
  };
}

const MAX_POINTS = 3000;

/**
 * Append an account-value sample. Skips samples closer than `minGapSec` to the last one unless
 * `force` (e.g. right after a trade closes), and caps the history so saved state stays small.
 */
export function recordEquity(state: PaperState, equity: number, time: number, opts: { minGapSec?: number; force?: boolean } = {}): PaperState {
  const { minGapSec = 900, force = false } = opts;
  const hist = state.equityHistory ?? [];
  const last = hist.at(-1);
  if (!Number.isFinite(equity)) return state;
  if (last && !force && time - last.time < minGapSec) return state;
  if (last && last.time === time && last.equity === equity) return state;
  const next = [...hist, { time, equity }];
  return { ...state, equityHistory: next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next };
}
