import type { Candle } from "@/lib/data/types";
import type { Product } from "./costs";
import type { ExitReason } from "./types";

export interface WalkRules {
  direction: "long" | "short";
  product: Product;
  /** Absolute price distance of the stop from the entry fill. */
  stopDist?: number;
  trailing?: boolean;
  /** Absolute price distance of the target from the entry fill. */
  targetDist?: number;
  maxHoldBars?: number;
  /** exitSignal[j] true => condition held at close of bar j; exit fills at open of j+1. */
  exitSignal?: boolean[];
  slippageBps: number;
}

export interface WalkResult {
  exitIdx: number;
  exitPrice: number;
  exitReason: ExitReason;
  barsHeld: number;
  /** Max adverse / favourable excursion as % of entry price (>= 0). */
  maePct: number;
  mfePct: number;
}

/** Entry fill at the open of the entry bar, slipped against the trader. */
export function entryFill(open: number, direction: "long" | "short", slippageBps: number): number {
  const s = slippageBps / 1e4;
  return direction === "long" ? open * (1 + s) : open * (1 - s);
}

/**
 * Walks ONE trade forward from its entry bar until an exit fires. Pure: no portfolio state,
 * so the stop-loss study can replay identical entries under different exit rules.
 *
 * Rules (documented so results are interpretable):
 *  - Stop/target are checked on the entry bar too, using that bar's high/low.
 *  - If stop and target are both reachable in one bar, the stop wins (pessimistic).
 *  - If a bar opens beyond the stop, the fill is the open (gap), not the stop price.
 *  - Trailing stops are checked against the EXISTING stop first, then raised from this
 *    bar's extreme for use on the next bar (no lookahead).
 *  - Signal and time exits are decided at a close and fill at the next open.
 *  - Intraday product exits at the entry bar's close unless stopped/targeted earlier.
 *  - Data ending while open closes at the last close (reason "end").
 *  - Slippage is applied against the trader on every exit fill.
 */
export function walkTrade(c: Candle[], entryIdx: number, entryPrice: number, r: WalkRules): WalkResult {
  const sign = r.direction === "long" ? 1 : -1;
  const slipExit = (p: number) => p * (1 - (sign * r.slippageBps) / 1e4);
  let stop = r.stopDist !== undefined ? entryPrice - sign * r.stopDist : undefined;
  const target = r.targetDist !== undefined ? entryPrice + sign * r.targetDist : undefined;
  let best = entryPrice;
  let mae = 0;
  let mfe = 0;
  let pending: ExitReason | undefined;

  const track = (adverse: number, favourable: number) => {
    mae = Math.max(mae, (sign * (entryPrice - adverse)) / entryPrice * 100);
    mfe = Math.max(mfe, (sign * (favourable - entryPrice)) / entryPrice * 100);
  };
  const finish = (j: number, fill: number, reason: ExitReason, openExit: boolean): WalkResult => ({
    exitIdx: j,
    exitPrice: slipExit(fill),
    exitReason: reason,
    barsHeld: Math.max(1, openExit ? j - entryIdx : j - entryIdx + 1),
    maePct: mae,
    mfePct: mfe,
  });

  for (let j = entryIdx; j < c.length; j++) {
    const bar = c[j];
    const adverse = sign === 1 ? bar.low : bar.high;
    const favourable = sign === 1 ? bar.high : bar.low;

    if (pending && j > entryIdx) {
      const gapped = stop !== undefined && sign * (bar.open - stop) <= 0;
      track(bar.open, bar.open);
      return finish(j, bar.open, gapped ? "stop" : pending, true);
    }

    if (stop !== undefined && sign * (adverse - stop) <= 0) {
      const gapped = sign * (bar.open - stop) <= 0;
      const fill = gapped ? bar.open : stop;
      track(bar.open, bar.open);
      track(fill, fill);
      return finish(j, fill, "stop", gapped && j > entryIdx);
    }
    if (target !== undefined && sign * (favourable - target) >= 0) {
      const fill = sign * (bar.open - target) >= 0 && j > entryIdx ? bar.open : target;
      track(bar.open, bar.open);
      track(fill, fill);
      return finish(j, fill, "target", fill === bar.open && j > entryIdx);
    }

    track(adverse, favourable);

    if (r.trailing && r.stopDist !== undefined && stop !== undefined) {
      best = sign === 1 ? Math.max(best, bar.high) : Math.min(best, bar.low);
      const next = best - sign * r.stopDist;
      if (sign * (next - stop) > 0) stop = next;
    }

    if (r.product === "intraday") return finish(j, bar.close, "time", false);
    if (j === c.length - 1) return finish(j, bar.close, "end", false);

    const held = j - entryIdx + 1;
    if (r.exitSignal?.[j]) pending = "signal";
    else if (r.maxHoldBars !== undefined && held >= r.maxHoldBars) pending = "time";
  }
  // entryIdx beyond data: degenerate guard
  return finish(c.length - 1, c[c.length - 1].close, "end", false);
}
