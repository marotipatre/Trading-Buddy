import type { StockView } from "./stock-view";

export interface Holding { symbol: string; qty: number; avg: number }
export type Action = "hold" | "add" | "trim" | "exit";
export interface HoldingReview {
  symbol: string;
  qty: number;
  avg: number;
  price: number;
  value: number;
  pnl: number;
  pnlPct: number;
  weightPct: number;
  weekPct: number;
  /** Rupee change over the last week. */
  weekPnl: number;
  sector: string;
  action: Action;
  headline: string;
  reasons: string[];
  /** A stop worth having, if one is suggested. */
  stop?: number;
  view: StockView | null;
}
export interface PortfolioReview {
  rows: HoldingReview[];
  value: number;
  cost: number;
  pnl: number;
  pnlPct: number;
  weekPct: number;
  weekPnl: number;
  benchWeekPct: number | null;
  sectors: { sector: string; weightPct: number }[];
  notes: string[];
}

const HEAD: Record<Action, string> = { hold: "Hold", add: "Add on a dip", trim: "Trim", exit: "Exit or cut" };

/** A plain-rule opinion on one holding. The rules are listed in `reasons`; none of it is a prediction. */
export function reviewHolding(h: Holding, view: StockView | null, sector: string, totalValue: number): HoldingReview {
  const price = view?.price ?? h.avg;
  const value = price * h.qty;
  const pnl = (price - h.avg) * h.qty;
  const pnlPct = h.avg > 0 ? (price / h.avg - 1) * 100 : 0;
  const weightPct = totalValue > 0 ? (value / totalValue) * 100 : 0;
  const weekPct = view && Number.isFinite(view.ret.w1) ? view.ret.w1 : 0;
  const weekPnl = value - value / (1 + weekPct / 100);
  const reasons: string[] = [];
  let action: Action = "hold";
  let stop: number | undefined;

  if (!view) {
    reasons.push("Not enough price history to score this stock.");
  } else {
    const plan = view.plan;
    const trendDown = view.frames.daily === "down" && !view.aboveEma50;
    if (view.verdict === "avoid" && trendDown) {
      action = "exit";
      reasons.push("Trend is down: price is below its 50-day average and the 20-day is below the 50-day.");
      if (view.frames.weekly === "down") reasons.push("The weekly trend is down too.");
    } else if (weightPct > 25) {
      action = "trim";
      reasons.push(`This one stock is ${weightPct.toFixed(0)}% of your portfolio. Trimming toward 20% limits damage from a single bad result.`);
    } else if (view.rsi > 78 && pnlPct > 15) {
      action = "trim";
      reasons.push(`Up ${pnlPct.toFixed(0)}% and RSI is ${view.rsi.toFixed(0)} (overbought): consider booking part of the profit.`);
    } else if (view.verdict === "buy" && plan && weightPct < 12 && price <= plan.entry * 1.02) {
      action = "add";
      reasons.push(`Still a buy setup (score ${view.score}) and only ${weightPct.toFixed(0)}% of your portfolio.`);
    } else if (view.verdict === "avoid") {
      reasons.push("Weak score, but the trend has not clearly broken. Watch the 50-day average.");
    } else {
      reasons.push(view.verdict === "buy" ? "Trend and momentum still favour holding." : "Mixed signals: no strong reason to change.");
    }
    if (pnlPct < -12 && action !== "exit") reasons.push(`Down ${Math.abs(pnlPct).toFixed(0)}% from your average: decide your exit level now rather than hoping.`);
    if (plan) stop = plan.stop < price ? plan.stop : price * 0.93;
    else stop = price * 0.93;
  }
  return { symbol: h.symbol, qty: h.qty, avg: h.avg, price, value, pnl, pnlPct, weightPct, weekPct, weekPnl, sector, action, headline: HEAD[action], reasons, stop, view };
}

/** Review every holding and the portfolio as a whole, including last week's performance against the market. */
export function reviewPortfolio(holdings: Holding[], views: Map<string, StockView | null>, sectorOf: (symbol: string) => string, benchWeekPct: number | null = null): PortfolioReview {
  const total = holdings.reduce((s, h) => s + (views.get(h.symbol)?.price ?? h.avg) * h.qty, 0);
  const rows = holdings.map((h) => reviewHolding(h, views.get(h.symbol) ?? null, sectorOf(h.symbol), total)).sort((a, b) => b.value - a.value);
  const value = rows.reduce((s, r) => s + r.value, 0);
  const cost = rows.reduce((s, r) => s + r.avg * r.qty, 0);
  const weekPnl = rows.reduce((s, r) => s + r.weekPnl, 0);
  const startValue = value - weekPnl;
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.sector, (by.get(r.sector) ?? 0) + r.weightPct);
  const sectors = [...by.entries()].map(([sector, weightPct]) => ({ sector, weightPct })).sort((a, b) => b.weightPct - a.weightPct);

  const notes: string[] = [];
  const weekPct = startValue > 0 ? (weekPnl / startValue) * 100 : 0;
  if (benchWeekPct !== null) notes.push(weekPct >= benchWeekPct ? `This week you beat the Nifty 50 (${weekPct.toFixed(1)}% against ${benchWeekPct.toFixed(1)}%).` : `This week you lagged the Nifty 50 (${weekPct.toFixed(1)}% against ${benchWeekPct.toFixed(1)}%).`);
  if (sectors[0] && sectors[0].weightPct > 35) notes.push(`${sectors[0].sector} is ${sectors[0].weightPct.toFixed(0)}% of the portfolio. A single sector above about 35% makes results depend on that sector.`);
  if (rows.length > 0 && rows.length < 5) notes.push(`Only ${rows.length} holding${rows.length > 1 ? "s" : ""}: one bad stock moves the whole portfolio. Five to ten names across different sectors is more resilient.`);
  if (rows.length > 15) notes.push(`${rows.length} holdings is hard to follow closely. The weakest ones add little and cost attention.`);
  const exits = rows.filter((r) => r.action === "exit");
  if (exits.length) notes.push(`${exits.length} holding${exits.length > 1 ? "s are" : " is"} in a downtrend (${exits.map((e) => e.symbol.replace(/\.(NS|BO)$/, "")).join(", ")}). Money tied up there could go to stronger setups.`);
  const worst = [...rows].sort((a, b) => a.weekPnl - b.weekPnl)[0];
  if (worst && worst.weekPnl < 0) notes.push(`Biggest drag this week: ${worst.symbol.replace(/\.(NS|BO)$/, "")} (${worst.weekPct.toFixed(1)}%).`);

  return { rows, value, cost, pnl: value - cost, pnlPct: cost > 0 ? (value / cost - 1) * 100 : 0, weekPct, weekPnl, benchWeekPct, sectors, notes };
}
