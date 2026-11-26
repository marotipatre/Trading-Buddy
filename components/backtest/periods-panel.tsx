"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { periodStats } from "@/lib/engine/periods";
import type { Analysis } from "@/lib/engine/analyze";
import { fmtNum, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MetricCard } from "./metric-card";
import { NumberField } from "./number-field";

/** What the strategy earned in each month or week: how many trades, and how many periods reached your goal. */
export function PeriodsPanel({ a }: { a: Analysis }) {
  const [by, setBy] = useState<"month" | "week">("month");
  const [goal, setGoal] = useState(10);
  const s = periodStats(a.result.equity, a.result.trades, by, a.result.initialCapital, by === "month" ? goal : goal / 4);
  const unit = by === "month" ? "month" : "week";
  const max = Math.max(1, ...s.rows.map((r) => Math.abs(r.returnPct)));
  const rows = [...s.rows].reverse();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist">
          {(["month", "week"] as const).map((b) => (
            <button key={b} type="button" role="tab" aria-selected={by === b} onClick={() => setBy(b)}
              className={cn("rounded-md px-3 py-1 text-sm font-medium", by === b ? "bg-card shadow-sm" : "text-muted-foreground")}>{b === "month" ? "Monthly" : "Weekly"}</button>
          ))}
        </div>
        {by === "month" && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">Monthly goal (%)
            <NumberField className="h-8 w-20" min={1} max={100} step={1} value={goal} onChange={setGoal} />
          </label>
        )}
      </div>
      {s.periods === 0 ? <p className="text-sm text-muted-foreground">No trades to measure.</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label={`Profitable ${unit}s`} value={fmtPct(s.profitableShare * 100, 0)} sub={`${s.profitable} of ${s.periods} ${unit}s`} tone={s.profitableShare >= 0.5 ? "up" : "down"} />
            <MetricCard label={`Average ${unit}`} value={fmtPct(s.avgReturnPct, 2, { sign: true })} sub={`typical (median) ${fmtPct(s.medianReturnPct, 2, { sign: true })}`} tone={s.avgReturnPct > 0 ? "up" : "down"} />
            <MetricCard label={`Best / worst ${unit}`} value={`${fmtPct(s.best?.returnPct ?? 0, 1, { sign: true })} / ${fmtPct(s.worst?.returnPct ?? 0, 1, { sign: true })}`} sub={`${s.best?.label ?? ""} · ${s.worst?.label ?? ""}`} />
            <MetricCard label="Trades closed" value={`${fmtNum(s.avgTrades, 1)} per ${unit}`} sub={by === "month" ? `${s.hitTarget} of ${s.periods} months reached ${goal}%` : `${s.hitTarget} weeks reached ${fmtNum(goal / 4, 1)}%`} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Return by {unit}</CardTitle>
              <CardDescription>Account return in each {unit}. Months with no trades show 0. Results from one stock are a small sample: test a group on the Group tab before trusting a monthly target.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground"><tr><th className="py-1.5">{by === "month" ? "Month" : "Week of"}</th><th className="w-1/2">Return</th><th className="text-right">Trades</th><th className="text-right">Wins</th><th className="text-right">Profit</th></tr></thead>
                  <tbody className="divide-y">
                    {rows.map((r) => (
                      <tr key={r.key}>
                        <td className="py-1.5">{r.label}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="relative h-3 flex-1 rounded bg-muted/40">
                              <div className={cn("absolute top-0 h-3 rounded", r.returnPct >= 0 ? "left-1/2 bg-up" : "right-1/2 bg-down")} style={{ width: `${(Math.abs(r.returnPct) / max) * 50}%` }} />
                            </div>
                            <span className={cn("tabular w-16 text-right font-mono text-xs", r.returnPct >= 0 ? "text-up" : "text-down")}>{fmtPct(r.returnPct, 1, { sign: true })}</span>
                          </div>
                        </td>
                        <td className="tabular text-right font-mono">{r.trades}</td>
                        <td className="tabular text-right font-mono">{r.wins}</td>
                        <td className={cn("tabular text-right font-mono", r.pnl >= 0 ? "text-up" : "text-down")}>₹{Math.round(r.pnl).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
