"use client";

import { CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { fmtPct } from "@/lib/format";
import { AXIS, GRID, TooltipBox } from "./chart-tooltip";

interface Pt { maePct: number; mfePct: number; returnPct: number }

/**
 * Each dot is one trade held WITHOUT a stop. X = how far it fell against you before it ended,
 * Y = how far it rose in your favour. Winners that dip deep are the ones a tight stop would kill.
 */
export function MaeMfeChart({ points, stopPct }: { points: Pt[]; stopPct?: number }) {
  const winners = points.filter((p) => p.returnPct > 0);
  const losers = points.filter((p) => p.returnPct <= 0);
  return (
    <div className="h-72 w-full" role="img" aria-label="Scatter of max adverse excursion against max favourable excursion per trade">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 18, left: 0 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis type="number" dataKey="maePct" name="Max drawdown in trade" {...AXIS} tickLine={false}
            tickFormatter={(v: number) => `${v}%`} label={{ value: "Worst dip against you (%)", position: "insideBottom", offset: -10, fill: "var(--muted-foreground)", fontSize: 11 }} />
          <YAxis type="number" dataKey="mfePct" name="Best run in trade" {...AXIS} tickLine={false} width={44}
            tickFormatter={(v: number) => `${v}%`} />
          {stopPct !== undefined && (
            <ReferenceLine x={stopPct} stroke="var(--warn)" strokeDasharray="4 3" label={{ value: "your stop", fill: "var(--warn)", fontSize: 11, position: "top" }} />
          )}
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: "var(--muted-foreground)" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as Pt | undefined;
              if (!active || !p) return null;
              return (
                <TooltipBox rows={[
                  { label: "Result", value: fmtPct(p.returnPct, 1, { sign: true }) },
                  { label: "Worst dip", value: fmtPct(p.maePct, 1) },
                  { label: "Best run", value: fmtPct(p.mfePct, 1) },
                ]} />
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
          <Scatter name="Winners" data={winners} fill="var(--series-3)" fillOpacity={0.85} stroke="var(--card)" strokeWidth={1.5} isAnimationActive={false} />
          <Scatter name="Losers" data={losers} fill="var(--series-2)" fillOpacity={0.85} stroke="var(--card)" strokeWidth={1.5} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
