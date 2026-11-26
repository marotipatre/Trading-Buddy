import type { ClosedTrade } from "@/lib/paper/types";

export interface TagAdvice { match: RegExp; advice: string; book: "swing" | "intraday"; anchor: string }

/** What to do about each kind of mistake, and where the rule book covers it. Matches both the swing and intraday tags. */
export const TAG_ADVICE: TagAdvice[] = [
  { match: /revenge/i, advice: "After a loss, step away for 15 minutes and do not trade the same stock again that day. Make a hard daily loss limit.", book: "intraday", anchor: "psychology-and-discipline" },
  { match: /moved stop|move.*stop/i, advice: "Place the stop as an order and never move it away. Treat moving it as a rule break to log.", book: "swing", anchor: "plan-every-trade-before-you-enter" },
  { match: /no stop/i, advice: "Do not enter until the stop-loss order is placed with the trade. The order ticket checks this for you.", book: "swing", anchor: "plan-every-trade-before-you-enter" },
  { match: /oversized|oversize/i, advice: "Size from the stop: shares = risk money divided by the distance to the stop. Use the position-size calculator.", book: "swing", anchor: "position-sizing-and-portfolio-risk" },
  { match: /fomo|chased/i, advice: "If price is already well above your planned entry, skip it. There is always another setup.", book: "swing", anchor: "choose-what-to-trade" },
  { match: /early exit/i, advice: "Use a pre-set target and a trailing stop so winners are managed by rules, not nerves.", book: "swing", anchor: "exit-playbook-winners-decide-your-year" },
  { match: /held too long/i, advice: "Add a time stop: if a trade has not worked in 10 to 15 sessions (45 to 60 minutes intraday), exit.", book: "swing", anchor: "exit-playbook-winners-decide-your-year" },
  { match: /no plan/i, advice: "Write entry, stop and target before you buy. Use the checklist on the rule book page.", book: "swing", anchor: "checklist" },
  { match: /broke daily limit/i, advice: "The daily loss limit is the most important rule. Let the Intraday page lock your orders when it is reached.", book: "intraday", anchor: "hard-limits-the-rules-that-protect-your-pot" },
  { match: /bored/i, advice: "No setup means no trade. Cap trades per day and close the platform outside your planned windows.", book: "intraday", anchor: "psychology-and-discipline" },
];
const GOOD = /followed plan|good setup/i;

export interface WeeklyReview {
  weekStart: number;
  trades: number;
  wins: number;
  netPnl: number;
  avgR?: number;
  best?: ClosedTrade;
  worst?: ClosedTrade;
  mistakes: { tag: string; count: number }[];
  clean: number;
  focus?: { tag: string; advice: string; book: "swing" | "intraday"; anchor: string };
}

const DAY = 86400, IST = 19800;
/** Monday 00:00 IST of the week containing `t`, as unix seconds. */
export function weekStartOf(t: number): number {
  const day = Math.floor((t + IST) / DAY);
  const monday = day - ((day + 3) % 7);
  return monday * DAY - IST;
}

/** The trades closed in the week containing `now`, with the mistakes tagged and the one habit most worth fixing. */
export function weeklyReview(allTrades: ClosedTrade[], now: number): WeeklyReview {
  const start = weekStartOf(now);
  const trades = allTrades.filter((t) => t.exitTime >= start && t.exitTime < start + 7 * DAY);
  const counts = new Map<string, { tag: string; count: number }>(); // tags are matched ignoring case
  for (const t of trades) for (const tag of t.tags ?? []) {
    if (GOOD.test(tag) || !TAG_ADVICE.some((a) => a.match.test(tag))) continue;
    const k = tag.trim().toLowerCase();
    counts.set(k, { tag: counts.get(k)?.tag ?? tag.trim(), count: (counts.get(k)?.count ?? 0) + 1 });
  }
  const mistakes = [...counts.values()].sort((a, b) => b.count - a.count);
  const rs = trades.flatMap((t) => (t.rMultiple !== undefined && Number.isFinite(t.rMultiple) ? [t.rMultiple] : []));
  const top = mistakes[0];
  const adv = top ? TAG_ADVICE.find((a) => a.match.test(top.tag)) : undefined;
  const sorted = [...trades].sort((a, b) => a.netPnl - b.netPnl);
  return {
    weekStart: start, trades: trades.length, wins: trades.filter((t) => t.netPnl > 0).length, netPnl: trades.reduce((s, t) => s + t.netPnl, 0),
    avgR: rs.length ? rs.reduce((s, x) => s + x, 0) / rs.length : undefined,
    best: sorted.length ? sorted[sorted.length - 1] : undefined, worst: sorted.length ? sorted[0] : undefined, mistakes,
    clean: trades.length ? trades.filter((t) => !(t.tags ?? []).some((x) => !GOOD.test(x) && TAG_ADVICE.some((a) => a.match.test(x)))).length / trades.length : 1,
    focus: top && adv ? { tag: top.tag, advice: adv.advice, book: adv.book, anchor: adv.anchor } : undefined,
  };
}
