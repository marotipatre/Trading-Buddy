export interface TradeCheckInput {
  closing: boolean;
  hasStop: boolean;
  /** Rupees lost if the stop is hit, as a percent of free cash. */
  riskPctOfCash?: number;
  /** Reward divided by risk, if both a stop and a target are set. */
  rr?: number;
  /** Order value as a percent of free cash. */
  positionPctOfCash: number;
  product: "delivery" | "intraday";
  /** Minutes since midnight in IST, for the late-session warning. */
  minutesIst?: number;
}
export interface TradeCheck { level: "ok" | "warn"; text: string }

/** A last look before an order goes in, based on the rule book: a stop, small risk, enough reward, sensible size. */
export function tradeChecks(i: TradeCheckInput): TradeCheck[] {
  if (i.closing) return [];
  const out: TradeCheck[] = [];
  if (!i.hasStop) out.push({ level: "warn", text: "No stop-loss. Decide the most you will lose before you buy, and let the order enforce it." });
  else {
    out.push({ level: "ok", text: "Stop-loss is set." });
    if (i.riskPctOfCash !== undefined) {
      out.push(i.riskPctOfCash > 2
        ? { level: "warn", text: `Risking ${i.riskPctOfCash.toFixed(1)}% of your cash on one trade. Most professionals keep it near 1%.` }
        : { level: "ok", text: `Risk is ${i.riskPctOfCash.toFixed(2)}% of your cash.` });
    }
  }
  if (i.rr !== undefined) {
    out.push(i.rr < 1.5
      ? { level: "warn", text: `Reward is only ${i.rr.toFixed(1)}x the risk. Aim for 2x or more.` }
      : { level: "ok", text: `Reward is ${i.rr.toFixed(1)}x the risk.` });
  }
  if (i.positionPctOfCash > 40) out.push({ level: "warn", text: `This one position is ${Math.round(i.positionPctOfCash)}% of your cash. Spread across several stocks.` });
  if (i.product === "intraday" && i.minutesIst !== undefined && i.minutesIst >= 14 * 60 + 30) out.push({ level: "warn", text: "Late in the session: intraday trades square off at 3:15 pm, leaving little time." });
  return out;
}
