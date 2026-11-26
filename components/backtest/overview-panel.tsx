import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Candle } from "@/lib/data/types";
import type { Analysis } from "@/lib/engine/analyze";
import { equityVsBuyHold } from "@/lib/chart-data";
import { fmtNum, fmtPct } from "@/lib/format";
import { DrawdownChart } from "./drawdown-chart";
import { EquityChart } from "./equity-chart";
import { MetricCard } from "./metric-card";

export function OverviewPanel({ a, candles }: { a: Analysis; candles: Candle[] }) {
  const m = a.metrics;
  const rows = equityVsBuyHold(candles, a.result.equity, a.result.initialCapital);
  const [lo, hi] = m.winRateCI;
  return (
    <div className="space-y-4">
      {a.warnings.length > 0 && (
        <div className="space-y-1 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
          {a.warnings.map((w) => (
            <p key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{w}</p>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Win probability" value={fmtPct(m.winRate * 100, 0)}
          sub={m.trades ? `95% range ${fmtPct(lo * 100, 0)} – ${fmtPct(hi * 100, 0)} · ${m.wins}/${m.trades} trades` : "No trades"}
          tone={m.winRate >= 0.5 ? "up" : undefined} />
        <MetricCard label="Expectancy / trade" value={fmtPct(m.expectancyPct, 2, { sign: true })}
          sub={`${fmtNum(m.expectancyR)} R · payoff ${fmtNum(m.payoffRatio)}`} tone={m.expectancyPct > 0 ? "up" : "down"} />
        <MetricCard label="Profit factor" value={fmtNum(m.profitFactor)} sub="gross profit ÷ gross loss" tone={m.profitFactor > 1 ? "up" : "down"} />
        <MetricCard label="Total return" value={fmtPct(m.totalReturnPct, 1, { sign: true })}
          sub={`Buy & hold ${fmtPct(a.buyHoldReturnPct, 1, { sign: true })} · CAGR ${fmtPct(m.cagrPct)}`}
          tone={m.totalReturnPct > a.buyHoldReturnPct ? "up" : "warn"} />
        <MetricCard label="Max drawdown" value={fmtPct(-m.maxDrawdownPct, 1)} sub={`Longest losing streak ${m.maxConsecutiveLosses}`} tone="down" />
        <MetricCard label="Sharpe (daily)" value={fmtNum(m.sharpe)} sub="risk-free rate 0" />
        <MetricCard label="Avg holding" value={`${fmtNum(m.avgBarsHeld, 1)} bars`} sub="trading days (daily data)" />
        <MetricCard label="Charges paid" value={`₹${Math.round(m.totalCharges).toLocaleString("en-IN")}`} sub="brokerage, STT, taxes" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Equity curve</CardTitle>
          <CardDescription>Strategy versus simply buying and holding the same stock</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <EquityChart rows={rows} />
          <DrawdownChart rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
