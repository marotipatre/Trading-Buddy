"use client";

import { useState } from "react";
import { PillTabs, Swap } from "@/components/motion/primitives";
import { Info } from "@/components/ui/info";
import { explainAnalysis } from "@/lib/engine/verdict";
import { cn } from "@/lib/utils";
import { PeriodsPanel } from "./periods-panel";
import { BacktestChart } from "./backtest-chart";
import type { StrategyDef } from "@/lib/engine/strategy";
import type { Candle } from "@/lib/data/types";
import type { Analysis } from "@/lib/engine/analyze";
import { OverviewPanel } from "./overview-panel";
import { RobustnessPanel } from "./robustness-panel";
import { StopLossPanel } from "./stoploss-panel";
import { TradesPanel } from "./trades-panel";

const DOT = { good: "bg-up", mixed: "bg-warn", bad: "bg-down", thin: "bg-muted-foreground" } as const;
type Tab = "chart" | "overview" | "periods" | "stoploss" | "robustness" | "trades";

export function BacktestResults({ analysis, candles, strategy }: { analysis: Analysis; candles: Candle[]; strategy: StrategyDef }) {
  const v = explainAnalysis(analysis);
  const [tab, setTab] = useState<Tab>("chart");
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border bg-card p-4">
        <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", DOT[v.tone])} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="font-heading text-lg font-semibold leading-snug">{v.headline}</div>
          {v.points[0] && <p className="mt-0.5 text-sm text-muted-foreground">{v.points[0]}</p>}
        </div>
        <Info label="Full reading" title="What the numbers say" align="end">
          <ul className="list-disc space-y-1 pl-4">{v.points.map((p) => <li key={p}>{p}</li>)}</ul>
          <p>A backtest shows what would have happened, not what will.</p>
        </Info>
      </div>
      <PillTabs value={tab} onChange={setTab} ariaLabel="Backtest results" options={[
        { value: "chart", label: "Chart" }, { value: "overview", label: "Overview" }, { value: "periods", label: "Months and weeks" },
        { value: "stoploss", label: "Stop-loss" }, { value: "robustness", label: "Robustness" }, { value: "trades", label: "Trades", badge: analysis.result.trades.length },
      ]} />
      <Swap id={tab}>
        {tab === "chart" && <BacktestChart candles={candles} trades={analysis.result.trades} strategy={strategy} />}
        {tab === "overview" && <OverviewPanel a={analysis} candles={candles} />}
        {tab === "periods" && <PeriodsPanel a={analysis} />}
        {tab === "stoploss" && <StopLossPanel s={analysis.stopStudy} />}
        {tab === "robustness" && <RobustnessPanel a={analysis} />}
        {tab === "trades" && <TradesPanel trades={analysis.result.trades} />}
      </Swap>
    </div>
  );
}
