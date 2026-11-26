"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceChart, type ChartMarker, type ChartOverlay } from "@/components/chart/price-chart";
import type { Candle } from "@/lib/data/types";
import type { Trade } from "@/lib/engine/types";
import { averageSeries, averagesOf } from "@/lib/engine/ema-builder";
import type { StrategyDef } from "@/lib/engine/strategy";

const COLORS = ["#2563eb", "#f59e0b", "#a855f7", "#14b8a6", "#ec4899", "#64748b"];

/** The tested stock with the averages the strategy uses and every simulated buy and sell on it. */
export function BacktestChart({ candles, trades, strategy }: { candles: Candle[]; trades: Trade[]; strategy: StrategyDef }) {
  const { resolvedTheme } = useTheme();
  const avgs = useMemo(() => averagesOf(strategy), [strategy]);
  const overlays = useMemo<ChartOverlay[]>(
    () => avgs.map((a, i) => ({ label: `${a.kind.toUpperCase()} ${a.period}`, color: COLORS[i % COLORS.length], points: averageSeries(candles, a.kind, a.period) })),
    [avgs, candles],
  );
  const markers = useMemo<ChartMarker[]>(() => trades.flatMap((t) => {
    const long = t.direction === "long";
    return [
      { time: t.entryTime, position: long ? "belowBar" : "aboveBar", shape: long ? "arrowUp" : "arrowDown", tone: "primary", text: "Buy" } as ChartMarker,
      { time: t.exitTime, position: long ? "aboveBar" : "belowBar", shape: "circle", tone: t.netPnl >= 0 ? "up" : "down", text: `${t.returnPct >= 0 ? "+" : ""}${t.returnPct.toFixed(1)}% ${t.exitReason}` } as ChartMarker,
    ];
  }), [trades]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price, averages and trades</CardTitle>
        <CardDescription>
          Arrows mark where the test bought; circles mark the exit (green = profit, red = loss).
          {avgs.length > 0 && <> Lines: {avgs.map((a, i) => <span key={a.kind + a.period} className="mr-2 font-medium" style={{ color: COLORS[i % COLORS.length] }}>{a.kind.toUpperCase()} {a.period}</span>)}</>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PriceChart candles={candles} intraday={false} mode="candles" dark={resolvedTheme !== "light"} lines={[]} markers={markers}
          resetKey={`bt-${candles.length}-${candles[0]?.time}`} scale="price" overlays={overlays} />
      </CardContent>
    </Card>
  );
}
