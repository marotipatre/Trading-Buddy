import type { Candle } from "@/lib/data/types";
import { chargesForLeg, DEFAULT_COSTS, roundTripCharges, type CostConfig } from "./costs";
import { buildSignals, SeriesCache } from "./rules";
import type { StrategyDef } from "./strategy";
import type { EquityPoint, Trade } from "./types";
import { entryFill, walkTrade, type WalkRules } from "./walk";
import { atr } from "./indicators";

export interface BacktestResult {
  symbol: string;
  strategy: StrategyDef;
  trades: Trade[];
  equity: EquityPoint[];
  initialCapital: number;
  finalEquity: number;
  bars: number;
}

export interface Distances { stopDist?: number; targetDist?: number }

/** Stop/target distances from the ACTUAL entry fill; ATR is read at the signal bar. */
export function resolveDistances(strat: StrategyDef, entryPrice: number, atrAtSignal: number): Distances {
  let stopDist: number | undefined;
  if (strat.stopLoss) {
    const { type, value } = strat.stopLoss;
    stopDist = type === "percent" ? (entryPrice * value) / 100 : value * atrAtSignal;
    if (!Number.isFinite(stopDist) || stopDist <= 0) stopDist = undefined;
  }
  let targetDist: number | undefined;
  if (strat.target) {
    if (strat.target.type === "percent") targetDist = (entryPrice * strat.target.value) / 100;
    else if (stopDist !== undefined) targetDist = stopDist * strat.target.value;
  }
  return { stopDist, targetDist };
}

export function walkRulesFor(strat: StrategyDef, d: Distances, exitSignal: boolean[] | undefined, costs: CostConfig): WalkRules {
  return {
    direction: strat.direction,
    product: strat.product,
    stopDist: d.stopDist,
    trailing: strat.stopLoss?.trailing,
    targetDist: d.targetDist,
    maxHoldBars: strat.maxHoldBars,
    exitSignal,
    slippageBps: costs.slippageBps,
  };
}

/** Integer share count honouring the sizing rule and available cash. */
export function sizePosition(strat: StrategyDef, cash: number, entryPrice: number, stopDist: number | undefined, costs: CostConfig): number {
  const { type, value } = strat.sizing;
  let qty: number;
  if (type === "fixed_amount") qty = Math.floor(value / entryPrice);
  else if (type === "percent_equity") qty = Math.floor((cash * value) / 100 / entryPrice);
  else qty = stopDist ? Math.floor((cash * value) / 100 / stopDist) : 0;
  // Unleveraged: position plus round-trip charges must fit in cash.
  qty = Math.min(qty, Math.floor(cash / entryPrice));
  while (qty > 0 && qty * entryPrice + roundTripCharges(strat.direction, qty, entryPrice, entryPrice, strat.product, costs) > cash) qty--;
  return Math.max(0, qty);
}

export function runBacktest(
  symbol: string,
  candles: Candle[],
  strat: StrategyDef,
  costs: CostConfig = DEFAULT_COSTS,
): BacktestResult {
  const n = candles.length;
  const cache = new SeriesCache(candles);
  const entrySig = buildSignals(cache, strat.entry);
  const exitSig = strat.exit ? buildSignals(cache, strat.exit) : undefined;
  const atrSeries = atr(candles, strat.stopLoss?.atrPeriod ?? 14);

  const trades: Trade[] = [];
  const equity: EquityPoint[] = candles.map((c) => ({ time: c.time, equity: strat.initialCapital }));
  let cash = strat.initialCapital;
  let filledUpTo = -1; // equity already written for bars <= filledUpTo
  const entrySide = strat.direction === "long" ? "buy" : "sell";
  const sign = strat.direction === "long" ? 1 : -1;

  const carry = (from: number, to: number) => {
    for (let k = from; k <= to && k < n; k++) equity[k].equity = cash;
  };

  let i = 0;
  while (i < n - 1) {
    if (!entrySig[i]) { i++; continue; }
    const entryIdx = i + 1;
    const entryPrice = entryFill(candles[entryIdx].open, strat.direction, costs.slippageBps);
    const d = resolveDistances(strat, entryPrice, atrSeries[i]);
    const qty = sizePosition(strat, cash, entryPrice, d.stopDist, costs);
    if (qty < 1) { i++; continue; }

    carry(filledUpTo + 1, entryIdx - 1);
    const w = walkTrade(candles, entryIdx, entryPrice, walkRulesFor(strat, d, exitSig, costs));
    const entryCharges = chargesForLeg(entrySide, qty * entryPrice, strat.product, costs).total;
    const total = roundTripCharges(strat.direction, qty, entryPrice, w.exitPrice, strat.product, costs);
    const gross = sign * (w.exitPrice - entryPrice) * qty;
    const net = gross - total;
    const capitalUsed = qty * entryPrice;

    // Mark to market while the position is open, then realise at the exit bar.
    for (let k = entryIdx; k <= w.exitIdx; k++) {
      const px = k === w.exitIdx ? w.exitPrice : candles[k].close;
      equity[k].equity = k === w.exitIdx ? cash + net : cash - entryCharges + sign * (px - entryPrice) * qty;
    }
    cash += net;
    filledUpTo = w.exitIdx;

    trades.push({
      symbol,
      direction: strat.direction,
      entryTime: candles[entryIdx].time,
      entryIdx,
      entryPrice,
      exitTime: candles[w.exitIdx].time,
      exitIdx: w.exitIdx,
      exitPrice: w.exitPrice,
      qty,
      grossPnl: gross,
      charges: total,
      netPnl: net,
      returnPct: (net / capitalUsed) * 100,
      rMultiple: d.stopDist ? net / (d.stopDist * qty) : NaN,
      barsHeld: w.barsHeld,
      exitReason: w.exitReason,
      maePct: w.maePct,
      mfePct: w.mfePct,
      product: strat.product,
    });
    // A new signal may be read at the close of the exit bar (fills next open): never same-bar re-entry.
    i = w.exitIdx;
  }
  carry(filledUpTo + 1, n - 1);
  return { symbol, strategy: strat, trades, equity, initialCapital: strat.initialCapital, finalEquity: cash, bars: n };
}
