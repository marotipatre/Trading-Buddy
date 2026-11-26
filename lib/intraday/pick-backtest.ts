import type { Candle } from "@/lib/data/types";
import { scoreIntraday, topPicks, type IntradayPick } from "./picks";
import { evaluatePick, summarize, type PickResult, type Scorecard } from "./scorecard";

const istDate = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10);

export interface BacktestInput { symbol: string; name: string; sector: string; daily: Candle[]; bars5: Candle[] }
export interface BacktestDay { date: string; picks: { symbol: string; score: number; res: PickResult }[] }
export interface PickBacktest { days: BacktestDay[]; card: Scorecard; sessions: number; byScore: { band: string; card: Scorecard }[] }

/**
 * Replays the pick rules over past sessions: for each session, only daily candles up to the day before are visible, the
 * top picks are chosen exactly as the app does, and each one is judged on that day's 5-minute candles. No peeking ahead.
 * Free intraday history is short (about 40 sessions), so treat the result as a sanity check, not proof.
 */
export function backtestPicks(inputs: BacktestInput[], opts: { perDay?: number; perSector?: number; minScore?: number; confirm?: boolean } = {}): PickBacktest {
  const { perDay = 5, perSector = 2, minScore = 0, confirm = false } = opts;
  const dates = [...new Set(inputs.flatMap((i) => i.bars5.map((b) => istDate(b.time))))].sort();
  const days: BacktestDay[] = [];
  for (const date of dates) {
    const cands: IntradayPick[] = [];
    for (const inp of inputs) {
      const upTo = inp.daily.filter((c) => istDate(c.time) < date);
      const p = scoreIntraday(inp.symbol, inp.name, inp.sector, upTo);
      if (p && p.score >= minScore) cands.push({ ...p, forDate: date });
    }
    const chosen = topPicks(cands, perDay, perSector);
    const picks: BacktestDay["picks"] = [];
    for (const p of chosen) {
      const bars = inputs.find((i) => i.symbol === p.symbol)!.bars5;
      const res = evaluatePick(p, bars, { confirm });
      if (res) picks.push({ symbol: p.symbol, score: p.score, res });
    }
    if (picks.length) days.push({ date, picks });
  }
  const all = days.flatMap((d) => d.picks);
  const bands = [["Score under 70", 0, 70], ["Score 70 to 79", 70, 80], ["Score 80 and above", 80, 101]] as const;
  return {
    days, sessions: days.length, card: summarize(all.map((p) => p.res)),
    byScore: bands.map(([band, lo, hi]) => ({ band, card: summarize(all.filter((p) => p.score >= lo && p.score < hi).map((p) => p.res)) })),
  };
}
