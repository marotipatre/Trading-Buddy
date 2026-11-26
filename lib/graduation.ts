import type { ClosedTrade } from "@/lib/paper/types";
import { TAG_ADVICE } from "./weekly-review";

export interface Criterion { label: string; have: string; need: string; met: boolean; progress: number }
export interface Graduation { criteria: Criterion[]; ready: boolean; metCount: number }

const GOOD = /followed plan|good setup/i;
const isMistake = (tag: string) => !GOOD.test(tag) && TAG_ADVICE.some((a) => a.match.test(tag));

/**
 * The rule books say: do not move from paper to real money until you have enough trades, an average trade that earns after
 * costs, and a habit of following your plan. This measures those from the journal. It is a checklist for self-discipline,
 * not a statement that you will make money.
 */
export function graduation(trades: ClosedTrade[], opts: { minTrades?: number; minClean?: number } = {}): Graduation {
  const minTrades = opts.minTrades ?? 50, minClean = opts.minClean ?? 0.9;
  const n = trades.length;
  const exp = n ? trades.reduce((s, t) => s + t.returnPct, 0) / n : 0;
  const clean = n ? trades.filter((t) => !(t.tags ?? []).some(isMistake)).length / n : 0;
  const tagged = trades.filter((t) => (t.tags ?? []).length > 0).length;
  const withStop = trades.filter((t) => t.initialRisk !== undefined).length;
  const stopShare = n ? withStop / n : 0;
  const worst = trades.reduce((m, t) => Math.min(m, t.rMultiple !== undefined && Number.isFinite(t.rMultiple) ? t.rMultiple : 0), 0);
  const criteria: Criterion[] = [
    { label: "Enough trades", have: `${n}`, need: `${minTrades}+`, met: n >= minTrades, progress: Math.min(1, n / minTrades) },
    { label: "Average trade earns after costs", have: `${exp >= 0 ? "+" : ""}${exp.toFixed(2)}%`, need: "above 0", met: n >= 10 && exp > 0, progress: n >= 10 && exp > 0 ? 1 : 0 },
    { label: "Followed the plan (no tagged mistakes)", have: `${(clean * 100).toFixed(0)}%`, need: `${Math.round(minClean * 100)}%+`, met: n >= 10 && clean >= minClean, progress: Math.min(1, clean / minClean) },
    { label: "A stop-loss on nearly every trade", have: `${(stopShare * 100).toFixed(0)}%`, need: "90%+", met: n >= 10 && stopShare >= 0.9, progress: Math.min(1, stopShare / 0.9) },
    { label: "You tag your trades (honest journal)", have: `${n ? Math.round((tagged / n) * 100) : 0}%`, need: "50%+", met: n >= 10 && tagged / n >= 0.5, progress: Math.min(1, n ? tagged / n / 0.5 : 0) },
    { label: "No single loss worse than -2R", have: n ? `${worst.toFixed(1)}R worst` : "no trades", need: "-2R or better", met: n >= 10 && worst >= -2, progress: n >= 10 && worst >= -2 ? 1 : 0 },
  ];
  const metCount = criteria.filter((c) => c.met).length;
  return { criteria, metCount, ready: metCount === criteria.length };
}
