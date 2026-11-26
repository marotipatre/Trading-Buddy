import type { StockView } from "./stock-view";

export interface SectorRow {
  sector: string;
  stocks: number;
  /** Average return over the period, in percent. */
  w1: number;
  m1: number;
  m3: number;
  /** Share of the sector's stocks above their 50-day average, 0-100. */
  breadth: number;
  /** Average 1-month return minus the benchmark's. */
  relM1: number;
  buys: number;
  score: number;
  stance: "focus" | "neutral" | "avoid";
}

const avg = (a: number[]) => { const f = a.filter(Number.isFinite); return f.length ? f.reduce((x, y) => x + y, 0) / f.length : 0; };

/** Rank sectors by trend breadth, recent returns relative to the market, and how many members are buy setups. */
export function rankSectors(items: { sector: string; view: StockView }[], benchmarkM1 = 0, minStocks = 3): SectorRow[] {
  const by = new Map<string, StockView[]>();
  for (const it of items) by.set(it.sector, [...(by.get(it.sector) ?? []), it.view]);
  const rows: SectorRow[] = [];
  for (const [sector, vs] of by) {
    if (vs.length < minStocks) continue;
    const breadth = (vs.filter((v) => v.aboveEma50).length / vs.length) * 100;
    const m1 = avg(vs.map((v) => v.ret.m1)), m3 = avg(vs.map((v) => v.ret.m3)), w1 = avg(vs.map((v) => v.ret.w1));
    const relM1 = m1 - benchmarkM1;
    const buys = vs.filter((v) => v.verdict === "buy").length;
    const score = Math.round(Math.max(0, Math.min(100, breadth * 0.45 + (Math.max(-10, Math.min(10, relM1)) + 10) * 1.5 + (buys / vs.length) * 25 + Math.max(-10, Math.min(10, w1)) * 0.5 + 5)));
    rows.push({ sector, stocks: vs.length, w1, m1, m3, breadth, relM1, buys, score, stance: "neutral" });
  }
  rows.sort((a, b) => b.score - a.score);
  return rows.map((r) => ({ ...r, stance: r.score >= 60 && r.breadth >= 55 ? "focus" : r.score < 40 || r.breadth < 35 ? "avoid" : "neutral" }));
}
