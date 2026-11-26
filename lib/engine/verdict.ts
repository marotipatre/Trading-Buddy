import type { Analysis } from "./analyze";

export interface Verdict {
  tone: "good" | "mixed" | "bad" | "thin";
  headline: string;
  points: string[];
}

const pct = (n: number, d = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;

/**
 * A plain-language reading of a single-stock backtest for someone new to this: was there enough data, did it make money
 * per trade, does it hold up in the part of history it was not tuned on, and did it beat just holding. Rules only, no model.
 */
export function explainAnalysis(a: Analysis): Verdict {
  const m = a.metrics;
  const points: string[] = [];
  if (m.trades === 0) return { tone: "thin", headline: "The strategy never triggered on this stock.", points: ["Try a longer history, another stock, or looser entry rules."] };

  const [lo, hi] = m.winRateCI;
  points.push(`${m.trades} trades. It won ${(m.winRate * 100).toFixed(0)}% of them (the honest range is ${(lo * 100).toFixed(0)}% to ${(hi * 100).toFixed(0)}%).`);
  points.push(`An average trade made ${pct(m.expectancyPct, 2)} after costs; the average winner was ${pct(m.avgWinPct)} and the average loser ${pct(m.avgLossPct)}.`);
  points.push(`The worst fall in your account along the way was ${m.maxDrawdownPct.toFixed(0)}% and the longest losing streak ${m.maxConsecutiveLosses} trades.`);

  const beat = m.totalReturnPct > a.buyHoldReturnPct;
  points.push(beat ? `It returned ${pct(m.totalReturnPct)} against ${pct(a.buyHoldReturnPct)} for simply holding: it beat holding.`
    : `It returned ${pct(m.totalReturnPct)} against ${pct(a.buyHoldReturnPct)} for simply holding: holding did better.`);

  const oos = a.outOfSample;
  let held = true;
  if (oos && oos.outSample.trades >= 5) {
    held = oos.outSample.expectancyPct > 0;
    points.push(held ? `In the later 30% of history (not used to shape the rules) the average trade was still ${pct(oos.outSample.expectancyPct, 2)}.`
      : `In the later 30% of history the average trade was ${pct(oos.outSample.expectancyPct, 2)}: the early success did not carry over.`);
  }
  if (m.lowSample) points.push(`Only ${m.trades} trades: with fewer than 30, a good or bad result can easily be luck.`);

  if (m.lowSample) return { tone: "thin", headline: "Too few trades to trust this result.", points };
  if (m.expectancyPct > 0 && held && m.profitFactor >= 1.2) return { tone: beat ? "good" : "mixed", headline: beat ? "Looks promising on this stock, but test it on more stocks." : "Made money per trade, but holding the stock did better.", points };
  if (m.expectancyPct > 0) return { tone: "mixed", headline: held ? "A thin edge: small average profit per trade." : "Worked early, not later: be careful.", points };
  return { tone: "bad", headline: "On this stock the strategy lost money per trade.", points };
}
