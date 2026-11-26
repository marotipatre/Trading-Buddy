"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/backtest/number-field";
import { SimpleSelect } from "@/components/backtest/simple-select";
import { METHODS, type Method } from "@/lib/analysis/methods";
import type { Frame } from "@/lib/analysis/stock-view";
import { cn } from "@/lib/utils";

export interface PlanState { amount: number; days: number; target: number; risk: number }
export const DEFAULT_PLAN: PlanState = { amount: 100000, days: 15, target: 6, risk: 1 };
const SUGGEST = (days: number) => (days <= 7 ? 3 : days <= 15 ? 6 : days <= 30 ? 10 : 15);

/** The three things you decide, in one sentence. Everything else is a default you can open up under the gear. */
export function PlanBar({ plan, onPlan, method, onMethod, frame, onFrame }: {
  plan: PlanState; onPlan: (p: PlanState) => void; method: Method; onMethod: (m: Method) => void; frame: Frame; onFrame: (f: Frame) => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const setDays = (days: number) => onPlan({ ...plan, days, target: SUGGEST(days) });
  const m = METHODS.find((x) => x.id === method)!;
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
        <span className="pb-2 text-sm font-medium text-muted-foreground">I want to invest</span>
        <div className="w-36 space-y-1"><Label className="sr-only">Amount to invest in rupees</Label><NumberField min={1000} step={25000} value={plan.amount} onChange={(amount) => onPlan({ ...plan, amount })} /></div>
        <span className="pb-2 text-sm font-medium text-muted-foreground">for</span>
        <div className="flex items-center gap-1.5">
          {[7, 15, 30].map((d) => (
            <button key={d} type="button" aria-pressed={plan.days === d} onClick={() => setDays(d)}
              className={cn("h-9 rounded-lg border px-3 text-sm font-medium transition-colors", plan.days === d ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{d} days</button>
          ))}
          <div className="w-20"><Label className="sr-only">Custom number of days</Label><NumberField min={2} max={365} value={plan.days} onChange={(d) => setDays(Math.max(2, Math.round(d)))} /></div>
        </div>
        <span className="pb-2 text-sm font-medium text-muted-foreground">aiming for</span>
        <div className="flex items-center gap-1.5"><div className="w-20"><Label className="sr-only">Target return percent</Label><NumberField min={0.5} max={200} step={0.5} value={plan.target} onChange={(target) => onPlan({ ...plan, target })} /></div><span className="pb-0 text-sm text-muted-foreground">%</span></div>
        <button type="button" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm text-muted-foreground hover:text-foreground"><SlidersHorizontal className="size-4" /> Settings</button>
      </div>
      {advanced && (
        <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">How stocks are judged</Label><SimpleSelect className="w-full" value={method} onChange={onMethod} options={METHODS.map((x) => ({ value: x.id, label: x.label }))} /></div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Candle size</Label><SimpleSelect className="w-full" value={method === "trend" ? frame : "daily"} onChange={onFrame} options={[{ value: "daily", label: "Daily (1–3 weeks)" }, { value: "weekly", label: "Weekly (3–8 weeks)" }, { value: "monthly", label: "Monthly (2–6 months)" }]} /></div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Risk per trade (% of amount)</Label><NumberField min={0.25} max={5} step={0.25} value={plan.risk} onChange={(risk) => onPlan({ ...plan, risk })} /></div>
          <p className="text-xs text-muted-foreground lg:col-span-1"><b>{m.label}:</b> {m.blurb}</p>
        </div>
      )}
    </div>
  );
}
