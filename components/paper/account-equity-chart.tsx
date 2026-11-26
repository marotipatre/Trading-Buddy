"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, GRID, TooltipBox } from "@/components/backtest/chart-tooltip";
import { downsample } from "@/lib/chart-data";
import { fmtInr, fmtPct } from "@/lib/format";

export function AccountEquityChart({ history, initial }: { history: { time: number; equity: number }[]; initial: number }) {
  const data = downsample(history, 500);
  return (
    <div className="h-56 w-full" role="img" aria-label="Paper account value over time">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="time" {...AXIS} tickLine={false} axisLine={false} minTickGap={48}
            tickFormatter={(t: number) => new Date(t * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} />
          <YAxis {...AXIS} tickLine={false} axisLine={false} width={64} domain={["auto", "auto"]} tickFormatter={(v: number) => `${(v / 100000).toFixed(1)}L`} />
          <ReferenceLine y={initial} stroke="var(--muted-foreground)" strokeDasharray="4 3" />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as { time: number; equity: number } | undefined;
              if (!active || !p) return null;
              return (
                <TooltipBox
                  title={new Date(p.time * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  rows={[{ label: "Account value", value: fmtInr(p.equity) }, { label: "vs start", value: fmtPct((p.equity / initial - 1) * 100, 2, { sign: true }) }]}
                />
              );
            }}
          />
          <Line dataKey="equity" stroke="var(--series-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
