import type { ClosedTrade } from "@/lib/paper/types";

/** Mistakes worth tagging. Each one is a rule in the rule book; counting them shows which rule you break most. */
export const MISTAKE_TAGS = ["chased entry", "no plan", "moved stop", "revenge trade", "oversized", "early exit", "held too long", "broke daily limit", "bored trade"] as const;

const PICK_RE = /^pick:(\d{4}-\d{2}-\d{2})/;
/** The session date of the pick a trade came from, if it was placed from one. */
export const pickDateOf = (t: Pick<ClosedTrade, "note">): string | null => t.note?.match(PICK_RE)?.[1] ?? null;
/** The note with the pick marker removed (what the trader wrote). */
export const userNote = (t: Pick<ClosedTrade, "note">): string => (t.note ?? "").replace(/^pick:\d{4}-\d{2}-\d{2}\s*\|?\s*/, "");
/** Rebuild a note after editing, keeping the pick marker. */
export const withUserNote = (t: Pick<ClosedTrade, "note">, text: string): string => {
  const d = pickDateOf(t);
  const clean = text.trim();
  return d ? (clean ? `pick:${d} | ${clean}` : `pick:${d}`) : clean;
};

/** How often each mistake tag appears in trades closed since `sinceSec`, most common first. */
export function mistakeCounts(trades: ClosedTrade[], sinceSec: number): { tag: string; count: number }[] {
  const m = new Map<string, number>();
  for (const t of trades) if (t.exitTime >= sinceSec) for (const tag of t.tags ?? []) if ((MISTAKE_TAGS as readonly string[]).includes(tag)) m.set(tag, (m.get(tag) ?? 0) + 1);
  return [...m.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
}

/** Share of closed trades with no mistake tag, a rough measure of rule-following (only meaningful if you tag honestly). */
export function cleanShare(trades: ClosedTrade[]): number {
  if (!trades.length) return 1;
  return trades.filter((t) => !(t.tags ?? []).some((x) => (MISTAKE_TAGS as readonly string[]).includes(x))).length / trades.length;
}
