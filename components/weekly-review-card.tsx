"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNow } from "@/components/use-now";
import { fmtInr, fmtPct } from "@/lib/format";
import { weeklyReview } from "@/lib/weekly-review";
import { displaySymbol } from "@/lib/symbols";
import { cn } from "@/lib/utils";
import type { ClosedTrade } from "@/lib/paper/types";

/** This week's trades, the mistakes you tagged, and the one habit to work on next, linked to its rule. */
export function WeeklyReviewCard({ trades, title = "This week" }: { trades: ClosedTrade[]; title?: string }) {
  const now = useNow(60_000);
  const r = weeklyReview(trades, now);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}: weekly review</CardTitle>
        <CardDescription>Since Monday. Tag your mistakes honestly: the review turns them into one thing to fix.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {r.trades === 0 ? <p className="text-muted-foreground">No closed trades this week yet.</p> : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><div className="text-xs text-muted-foreground">Trades</div><div className="font-mono text-lg font-semibold">{r.trades}</div></div>
              <div><div className="text-xs text-muted-foreground">Winners</div><div className="font-mono text-lg font-semibold">{fmtPct((r.wins / r.trades) * 100, 0)}</div></div>
              <div><div className="text-xs text-muted-foreground">Net result</div><div className={cn("tabular font-mono text-lg font-semibold", r.netPnl >= 0 ? "text-up" : "text-down")}>{fmtInr(r.netPnl, { sign: true })}</div></div>
              <div><div className="text-xs text-muted-foreground">Clean trades</div><div className="font-mono text-lg font-semibold">{fmtPct(r.clean * 100, 0)}</div></div>
            </div>
            {(r.best && r.worst) && <p className="text-xs text-muted-foreground">Best: <b className="font-mono text-foreground">{displaySymbol(r.best.symbol)}</b> {fmtInr(r.best.netPnl, { sign: true })} · Worst: <b className="font-mono text-foreground">{displaySymbol(r.worst.symbol)}</b> {fmtInr(r.worst.netPnl, { sign: true })}{r.avgR !== undefined && <> · Average {r.avgR >= 0 ? "+" : ""}{r.avgR.toFixed(2)}R</>}</p>}
            {r.focus ? (
              <div className="rounded-lg border border-warn/40 bg-warn/5 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-warn">One thing to fix next week</div>
                <p className="mt-1"><b>{r.focus.tag}</b> ({r.mistakes[0].count}×). {r.focus.advice}</p>
                <Link className="mt-1 inline-block text-xs text-primary underline" href={`/playbook?book=${r.focus.book}#${r.focus.anchor}`}>Read the rule</Link>
              </div>
            ) : <p className="rounded-lg border border-up/40 bg-up/5 p-3">No mistakes tagged this week. If that is honest, keep doing exactly this. If you have not been tagging, start: it is the fastest way to improve.</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
