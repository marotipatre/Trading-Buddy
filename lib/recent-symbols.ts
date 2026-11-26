const KEY = "trading-buddy:recent-symbols:v1";
const MAX = 8;

/** Pure: put `symbol` first, drop duplicates, cap the list. */
export function withRecent(list: string[], symbol: string, max = MAX): string[] {
  return [symbol, ...list.filter((s) => s !== symbol)].slice(0, max);
}

export function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecent(symbol: string): string[] {
  const next = withRecent(loadRecent(), symbol);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}
