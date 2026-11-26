/** A trade plan carried in a link: Ideas and Intraday open the chart and order ticket with entry, stop and target filled in. */
export interface PlanLink { entry: number; stop: number; target: number }

export function planToQuery(p: PlanLink): string {
  return `entry=${p.entry.toFixed(2)}&stop=${p.stop.toFixed(2)}&target=${p.target.toFixed(2)}`;
}

/** Read a plan from search params; null unless the three numbers are present and in order (stop < entry < target). */
export function planFromParams(get: (k: string) => string | null): PlanLink | null {
  const [entry, stop, target] = ["entry", "stop", "target"].map((k) => Number(get(k)));
  if (![entry, stop, target].every((n) => Number.isFinite(n) && n > 0)) return null;
  return stop < entry && entry < target ? { entry, stop, target } : null;
}
