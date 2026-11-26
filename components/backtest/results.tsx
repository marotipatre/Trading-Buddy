"use client";

import { explainAnalysis } from "@/lib/engine/verdict";
import { PeriodsPanel } from "./periods-panel";
import { BacktestChart } from "./backtest-chart";
import type { StrategyDef } from "@/lib/engine/strategy";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Candle } from "@/lib/data/types";
import type { Analysis } from "@/lib/engine/analyze";
import { OverviewPanel } from "./overview-panel";
import { RobustnessPanel } from "./robustness-panel";
import { StopLossPanel } from "./stoploss-panel";
import { TradesPanel } from "./trades-panel";

const TONE = { good: "border-up/40 bg-up/5", mixed: "border-warn/40 bg-warn/5", bad: "border-down/40 bg-down/5", thin: "border-border bg-muted/40" } as const;

export function BacktestResults({ analysis, candles, strategy }: { analysis: Analysis; candles: Candle[]; strategy: StrategyDef }) {
  const v = explainAnalysis(analysis);
  return (
    <div className="space-y-4">
    <div className={`rounded-xl border p-4 ${TONE[v.tone]}`}>
      <div className="text-base font-semibold">{v.headline}</div>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{v.points.map((p) => <li key={p}>{p}</li>)}</ul>
      <p className="mt-2 text-xs text-muted-foreground">Plain-language reading of the numbers below. A backtest shows what would have happened, not what will.</p>
    </div>
    <Tabs defaultValue="chart" className="space-y-4">
      <TabsList>
        <TabsTrigger value="chart">Chart</TabsTrigger>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="periods">Monthly &amp; weekly</TabsTrigger>
        <TabsTrigger value="stoploss">Stop-loss study</TabsTrigger>
        <TabsTrigger value="robustness">Probability &amp; robustness</TabsTrigger>
        <TabsTrigger value="trades">Trades ({analysis.result.trades.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="chart"><BacktestChart candles={candles} trades={analysis.result.trades} strategy={strategy} /></TabsContent>
      <TabsContent value="overview"><OverviewPanel a={analysis} candles={candles} /></TabsContent>
      <TabsContent value="periods"><PeriodsPanel a={analysis} /></TabsContent>
      <TabsContent value="stoploss"><StopLossPanel s={analysis.stopStudy} /></TabsContent>
      <TabsContent value="robustness"><RobustnessPanel a={analysis} /></TabsContent>
      <TabsContent value="trades"><TradesPanel trades={analysis.result.trades} /></TabsContent>
    </Tabs>
    </div>
  );
}
