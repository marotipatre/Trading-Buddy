"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePaper } from "@/components/paper/paper-provider";
import { has, isDone } from "@/lib/progress";
import { cn } from "@/lib/utils";

const DISMISS = "tb.gs.dismissed";

/** A short first-run checklist so a new user knows what to do and in what order. Hides itself when done or dismissed. */
export function GettingStarted() {
  const { state, ready } = usePaper();
  const [flags, setFlags] = useState<Record<string, boolean> | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read progress from this browser after mount
    setFlags({
      rules: isDone("rules"), ideas: has("tb.ideas.last.v1"), backtest: isDone("backtest"), intraday: has("tb.intraday.v1"), review: has("tb.review.holdings"),
      dismissed: has(DISMISS),
    });
  }, []);
  if (!flags || !ready || flags.dismissed) return null;
  const traded = state.trades.length > 0 || state.positions.length > 0;
  const steps = [
    { label: "Read the swing rule book", hint: "Ten minutes that will save you money", href: "/playbook?book=swing", done: flags.rules },
    { label: "Scan the market for ideas", hint: "Pick an amount, days and a target; see what fits", href: "/ideas", done: flags.ideas },
    { label: "Place your first paper trade", hint: "Open any stock and use the order ticket with a stop-loss", href: "/trade", done: traded },
    { label: "Test a strategy on history", hint: "Try the simple EMA builder; read the Chart tab", href: "/strategies", done: flags.backtest },
    { label: "Review your portfolio", hint: "Add what you hold for Hold / Add / Trim / Exit views", href: "/portfolio?tab=review", done: flags.review },
    { label: "Set up the intraday pot", hint: "A separate 5x margin account with its own P&L", href: "/intraday", done: flags.intraday },
  ];
  const n = steps.filter((s) => s.done).length;
  if (n === steps.length) return null;
  const todo = steps.filter((s) => !s.done);
  // Once you are past the first steps, shrink to one slim line of what is left instead of a big card.
  if (n >= 3) return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.04] px-3.5 py-2.5 text-sm">
      <span className="font-medium">{n} of {steps.length} steps done.</span>
      <span className="text-muted-foreground">Next:</span>
      {todo.map((t) => <Link key={t.label} href={t.href} title={t.hint} className="rounded-full border bg-card px-3 py-1 text-xs font-medium hover:bg-accent">{t.label}</Link>)}
      <button type="button" aria-label="Hide getting started" className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-accent" onClick={() => { try { localStorage.setItem(DISMISS, "1"); } catch { /* ignore */ } setFlags({ ...flags, dismissed: true }); }}><X className="size-4" /></button>
    </div>
  );
  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div><CardTitle>Getting started</CardTitle><CardDescription>{n} of {steps.length} done. Paper money only: the best place to make your mistakes.</CardDescription></div>
          <button type="button" aria-label="Hide getting started" className="rounded-md p-1 text-muted-foreground hover:bg-accent" onClick={() => { try { localStorage.setItem(DISMISS, "1"); } catch { /* ignore */ } setFlags({ ...flags, dismissed: true }); }}><X className="size-4" /></button>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(n / steps.length) * 100}%` }} /></div>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {steps.map((s) => (
          <Link key={s.label} href={s.href} className="flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50">
            <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border", s.done ? "border-primary bg-primary text-primary-foreground" : "text-transparent")}><Check className="size-3" /></span>
            <span className="min-w-0"><span className={cn("block text-sm font-medium", s.done && "text-muted-foreground line-through")}>{s.label}</span><span className="block text-xs text-muted-foreground">{s.hint}</span></span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
