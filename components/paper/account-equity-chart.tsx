"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, GRID, TooltipBox } from "@/components/backtest/chart-tooltip";
import { downsample } from "@/lib/chart-data";
import { fmtInr, fmtPct } from "@/lib/format";

export function AccountEquityChart({ history, initial }: { history: { time: number; equity: number; capital?: number }[]; initial: number }) {
  // Plot profit/loss against the capital in place at each moment, so deposits never look like gains.
  const data = downsample(history, 500).map((h) => ({ time: h.time, equity: h.equity, capital: h.capital ?? initial, pnl: h.equity - (h.capital ?? initial) }));
  return (
    <div className="h-56 w-full" role="img" aria-label="Paper trading profit and loss over time">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="time" {...AXIS} tickLine={false} axisLine={false} minTickGap={48}
            tickFormatter={(t: number) => new Date(t * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} />
          <YAxis {...AXIS} tickLine={false} axisLine={false} width={64} domain={["auto", "auto"]} tickFormatter={(v: number) => (Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}k`)} />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 3" />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as { time: number; equity: number; capital: number; pnl: number } | undefined;
              if (!active || !p) return null;
              return (
                <TooltipBox
                  title={new Date(p.time * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  rows={[{ label: "Profit / loss", value: fmtInr(p.pnl, { sign: true }) }, { label: "Return", value: fmtPct((p.pnl / p.capital) * 100, 2, { sign: true }) }, { label: "Balance", value: fmtInr(p.equity) }]}
                />
              );
            }}
          />
          <Line dataKey="pnl" stroke="var(--series-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
