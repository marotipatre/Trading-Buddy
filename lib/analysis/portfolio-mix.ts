import { positionSize, type StockView } from "./stock-view";

export interface MixInput { symbol: string; name: string; sector: string; view: StockView; /** Optional historical edge (percent per trade); higher is picked first. */ edge?: number }
export interface MixPick extends MixInput { qty: number; value: number; risk: number; reward: number; weightPct: number }
export interface Mix {
  picks: MixPick[];
  invested: number;
  cash: number;
  riskIfAllStopped: number;
  rewardIfTarget1: number;
  sectors: { sector: string; weightPct: number; names: number }[];
}

/**
 * A spread of buy setups across sectors: best score first, at most `maxPerSector` from one sector, each sized to risk
 * `riskPct` of capital, and a cash reserve kept back. This is arithmetic on the plans, not a prediction.
 */
export function buildMixedPortfolio(items: MixInput[], capital: number, riskPct: number, opts: { maxPerSector?: number; maxNames?: number; maxPositionPct?: number; reservePct?: number } = {}): Mix {
  const { maxPerSector = 2, maxNames = 8, maxPositionPct = 20, reservePct = 10 } = opts;
  const usable = capital * (1 - reservePct / 100);
  const perSector = new Map<string, number>();
  const picks: MixPick[] = [];
  let invested = 0;
  for (const it of [...items].sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0) || b.view.score - a.view.score)) {
    if (picks.length >= maxNames) break;
    const plan = it.view.plan;
    if (it.view.verdict !== "buy" || !plan) continue;
    if ((perSector.get(it.sector) ?? 0) >= maxPerSector) continue;
    const size = positionSize(capital, riskPct, maxPositionPct, plan);
    if (size.qty <= 0 || invested + size.value > usable) continue;
    invested += size.value;
    perSector.set(it.sector, (perSector.get(it.sector) ?? 0) + 1);
    picks.push({ ...it, ...size, reward: size.qty * (plan.target1 - plan.entry), weightPct: (size.value / capital) * 100 });
  }
  const sectors = [...perSector.entries()].map(([sector, names]) => ({ sector, names, weightPct: picks.filter((p) => p.sector === sector).reduce((s, p) => s + p.weightPct, 0) })).sort((a, b) => b.weightPct - a.weightPct);
  return {
    picks, invested, cash: capital - invested,
    riskIfAllStopped: picks.reduce((s, p) => s + p.risk, 0),
    rewardIfTarget1: picks.reduce((s, p) => s + p.reward, 0),
    sectors,
  };
}
