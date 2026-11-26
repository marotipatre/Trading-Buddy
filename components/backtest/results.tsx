"use client";

import { BacktestChart } from "./backtest-chart";
import type { StrategyDef } from "@/lib/engine/strategy";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Candle } from "@/lib/data/types";
import type { Analysis } from "@/lib/engine/analyze";
import { OverviewPanel } from "./overview-panel";
import { RobustnessPanel } from "./robustness-panel";
import { StopLossPanel } from "./stoploss-panel";
import { TradesPanel } from "./trades-panel";

export function BacktestResults({ analysis, candles, strategy }: { analysis: Analysis; candles: Candle[]; strategy: StrategyDef }) {
  return (
    <Tabs defaultValue="chart" className="space-y-4">
      <TabsList>
        <TabsTrigger value="chart">Chart</TabsTrigger>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="stoploss">Stop-loss study</TabsTrigger>
        <TabsTrigger value="robustness">Probability &amp; robustness</TabsTrigger>
        <TabsTrigger value="trades">Trades ({analysis.result.trades.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="chart"><BacktestChart candles={candles} trades={analysis.result.trades} strategy={strategy} /></TabsContent>
      <TabsContent value="overview"><OverviewPanel a={analysis} candles={candles} /></TabsContent>
      <TabsContent value="stoploss"><StopLossPanel s={analysis.stopStudy} /></TabsContent>
      <TabsContent value="robustness"><RobustnessPanel a={analysis} /></TabsContent>
      <TabsContent value="trades"><TradesPanel trades={analysis.result.trades} /></TabsContent>
    </Tabs>
  );
}
