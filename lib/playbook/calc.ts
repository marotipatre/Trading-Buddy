import { DEFAULT_COSTS, roundTripCharges, type CostConfig } from "@/lib/engine/costs";

/** Shares, rupee risk and margin for a trade: risk a share of the account on the distance to the stop. */
export function positionSize(capital: number, riskPct: number, entry: number, stop: number, leverage = 1) {
  const perShare = Math.abs(entry - stop);
  if (!(capital > 0) || !(riskPct > 0) || !(entry > 0) || !(perShare > 0)) return { qty: 0, riskAmt: 0, notional: 0, margin: 0, perSharePct: 0 };
  const qty = Math.floor((capital * riskPct) / 100 / perShare);
  return { qty, riskAmt: qty * perShare, notional: qty * entry, margin: (qty * entry) / Math.max(1, leverage), perSharePct: (perShare / entry) * 100 };
}

/** Expected result per trade in R, and the win rate at which the system breaks even. `winRate` is 0-1. */
export function expectancy(winRate: number, avgWinR: number, avgLossR: number) {
  const e = winRate * avgWinR - (1 - winRate) * avgLossR;
  const breakEven = avgWinR + avgLossR > 0 ? avgLossR / (avgWinR + avgLossR) : NaN;
  return { perTrade: e, breakEvenWinRate: breakEven, profitFactor: (1 - winRate) * avgLossR > 0 ? (winRate * avgWinR) / ((1 - winRate) * avgLossR) : Infinity };
}

/**
 * Chance of at least one run of `k` or more losses in a row somewhere in `n` trades, when each trade loses with
 * probability `pLoss` (independent trades). Dynamic programming over the length of the current losing run.
 */
export function streakProbability(pLoss: number, n: number, k: number): number {
  if (!(k >= 1) || !(n >= k)) return 0;
  const p = Math.min(1, Math.max(0, pLoss));
  let run = new Array<number>(k).fill(0); // run[i] = probability the current losing run has length i and no k-run has happened
  run[0] = 1;
  let hit = 0;
  for (let t = 0; t < n; t++) {
    const next = new Array<number>(k).fill(0);
    for (let i = 0; i < k; i++) {
      next[0] += run[i] * (1 - p);
      if (i + 1 === k) hit += run[i] * p; else next[i + 1] += run[i] * p;
    }
    run = next;
  }
  return hit;
}

/** Percent gain needed to get back after a percent loss. */
export const recoveryNeeded = (lossPct: number) => (lossPct >= 100 ? Infinity : (1 / (1 - lossPct / 100) - 1) * 100);

/** Cost of one intraday round trip and the price move needed just to break even. */
export function intradayBreakEven(price: number, qty: number, cfg: CostConfig = DEFAULT_COSTS, slippageBpsPerSide = 0) {
  if (!(price > 0) || !(qty > 0)) return { charges: 0, slippage: 0, total: 0, breakEvenPct: 0, perShare: 0 };
  const charges = roundTripCharges("long", qty, price, price, "intraday", { ...cfg, slippageBps: 0 });
  const slippage = qty * price * (slippageBpsPerSide / 10000) * 2;
  const total = charges + slippage;
  return { charges, slippage, total, breakEvenPct: (total / (qty * price)) * 100, perShare: total / qty };
}
