"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { downsample, type EquityRow } from "@/lib/chart-data";
import { fmtDate, fmtPct } from "@/lib/format";
import { AXIS, GRID, TooltipBox } from "./chart-tooltip";

export function DrawdownChart({ rows }: { rows: EquityRow[] }) {
  const data = downsample(rows, 700);
  return (
    <div className="h-40 w-full" role="img" aria-label="Strategy drawdown over time">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="time" {...AXIS} tickLine={false} axisLine={false} minTickGap={48}
            tickFormatter={(t: number) => new Date(t * 1000).getUTCFullYear().toString()} />
          <YAxis {...AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as EquityRow | undefined;
              if (!active || !r) return null;
              return <TooltipBox title={fmtDate(r.time)} rows={[{ label: "Drawdown", value: fmtPct(r.drawdown, 2) }]} />;
            }}
          />
          <Area dataKey="drawdown" stroke="var(--down)" strokeWidth={1.5} fill="var(--down)" fillOpacity={0.18} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
