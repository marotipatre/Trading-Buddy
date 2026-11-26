"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { downsample, type EquityRow } from "@/lib/chart-data";
import { fmtDate, fmtInr, fmtPct } from "@/lib/format";
import { AXIS, GRID, TooltipBox } from "./chart-tooltip";

export function EquityChart({ rows }: { rows: EquityRow[] }) {
  const data = downsample(rows, 700);
  return (
    <div className="h-72 w-full" role="img" aria-label="Equity curve of the strategy compared with buy and hold">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="time" {...AXIS} tickLine={false} axisLine={false} minTickGap={64}
            tickFormatter={(t: number) => new Date(t * 1000).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" })} />
          <YAxis {...AXIS} tickLine={false} axisLine={false} width={56} domain={["auto", "auto"]}
            tickFormatter={(v: number) => `${(v / 100000).toFixed(1)}L`} />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as EquityRow | undefined;
              if (!active || !r) return null;
              return (
                <TooltipBox
                  title={fmtDate(r.time)}
                  rows={[
                    { label: "Strategy", value: fmtInr(r.strategy), color: "var(--series-1)" },
                    { label: "Buy & hold", value: fmtInr(r.buyHold), color: "var(--series-2)" },
                    { label: "Drawdown", value: fmtPct(r.drawdown, 1) },
                  ]}
                />
              );
            }}
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
          <Line name="Strategy" dataKey="strategy" stroke="var(--series-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line name="Buy & hold" dataKey="buyHold" stroke="var(--series-2)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
