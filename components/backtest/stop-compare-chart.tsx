"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { VariantStats } from "@/lib/engine/stoploss-study";
import { fmtInr, fmtNum, fmtPct } from "@/lib/format";
import { AXIS, GRID, TooltipBox } from "./chart-tooltip";

/** Total P&L for every stop variant. The dashed line is "no stop-loss"; bars above it beat holding on. */
export function StopCompareChart({ variants, baseline, userLabel }: { variants: VariantStats[]; baseline: VariantStats; userLabel?: string }) {
  return (
    <div className="h-72 w-full" role="img" aria-label="Total profit for each stop-loss setting compared with no stop-loss">
      <ResponsiveContainer>
        <BarChart data={variants} margin={{ top: 8, right: 12, bottom: 28, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" {...AXIS} tickLine={false} interval={0} angle={-35} textAnchor="end" height={60} />
          <YAxis {...AXIS} tickLine={false} axisLine={false} width={60} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
          <ReferenceLine y={baseline.totalPnl} stroke="var(--warn)" strokeDasharray="4 3"
            label={{ value: "no stop", fill: "var(--warn)", fontSize: 11, position: "insideTopRight" }} />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
          <Tooltip
            cursor={{ fill: "color-mix(in oklch, var(--foreground) 6%, transparent)" }}
            content={({ active, payload }) => {
              const v = payload?.[0]?.payload as VariantStats | undefined;
              if (!active || !v) return null;
              return (
                <TooltipBox title={v.label} rows={[
                  { label: "Total P&L", value: fmtInr(v.totalPnl, { sign: true }) },
                  { label: "Win rate", value: fmtPct(v.winRate * 100, 0) },
                  { label: "Profit factor", value: fmtNum(v.profitFactor) },
                  { label: "Worst trade", value: fmtPct(v.worstTradePct, 1) },
                  { label: "Max drawdown", value: fmtPct(v.maxDrawdownPct, 1) },
                  { label: "Stopped out", value: `${v.stoppedOut}/${v.trades}` },
                ]} />
              );
            }}
          />
          <Bar dataKey="totalPnl" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
            {variants.map((v) => (
              <Cell key={v.label} fill="var(--series-1)"
                fillOpacity={v.label === userLabel ? 1 : 0.55} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
