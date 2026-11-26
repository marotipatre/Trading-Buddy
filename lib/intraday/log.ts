import type { IntradayPick } from "./picks";

const KEY = "tb.intraday.picks.v1";
export interface PickBatch { forDate: string; createdAt: number; picks: IntradayPick[] }

export function loadBatches(): PickBatch[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((b) => typeof b?.forDate === "string" && Array.isArray(b.picks)) : [];
  } catch { return []; }
}
/** Remember a day's picks (one batch per session date; a newer scan for the same date replaces it). Keeps 90 days. */
export function saveBatch(batch: PickBatch): PickBatch[] {
  const all = [...loadBatches().filter((b) => b.forDate !== batch.forDate), batch].sort((a, b) => a.forDate.localeCompare(b.forDate)).slice(-90);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage unavailable */ }
  return all;
}
