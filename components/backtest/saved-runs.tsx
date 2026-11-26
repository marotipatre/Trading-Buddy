"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, fmtNum, fmtPct } from "@/lib/format";
import { compareRuns, type SavedConfig, type SavedRun } from "@/lib/saved-backtests";
import { cn } from "@/lib/utils";

const KIND: Record<string, string> = { one: "One stock", group: "Group", optimize: "Optimize" };

export function SavedRuns({ runs, ready, localOnly, onLoad, onRemove }: {
  runs: SavedRun[]; ready: boolean; localOnly: boolean;
  onLoad: (c: SavedConfig) => void; onRemove: (id: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const chosen = useMemo(() => picked.map((id) => runs.find((r) => r.id === id)).filter((r): r is SavedRun => !!r), [picked, runs]);
  const best = useMemo(() => compareRuns(chosen), [chosen]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-3)));

  if (!ready) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved runs ({runs.length})</CardTitle>
        <CardDescription>
          Tick up to three to compare them side by side. Load puts the same settings back so you can run again on fresh data.
          {localOnly && " Saved in this browser only; run supabase/migrations/0002 to keep them in your account."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing saved yet. After a run, name it and press Save.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {runs.map((r) => {
              const s = r.summary;
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                  <input type="checkbox" aria-label={`Compare ${r.name}`} checked={picked.includes(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-[var(--primary)]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{s.label} · {fmtDate(r.createdAt)}</div>
                  </div>
                  <Badge variant="outline">{KIND[s.kind]}</Badge>
                  <div className="tabular hidden text-right font-mono text-xs sm:block">
                    {s.winRate !== null && <div>{fmtPct(s.winRate * 100, 0)} win · {s.trades} trades</div>}
                    {s.expectancyPct !== null && <div className={s.expectancyPct >= 0 ? "text-up" : "text-down"}>{fmtPct(s.expectancyPct, 2, { sign: true })} / trade</div>}
                    {s.note && <div className="text-muted-foreground">{s.note}</div>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onLoad(r.config)}>Load</Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${r.name}`} onClick={() => { setPicked((p) => p.filter((x) => x !== r.id)); onRemove(r.id); }}><Trash2 /></Button>
                </div>
              );
            })}
          </div>
        )}

        {chosen.length >= 2 && (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-3">Compare</TableHead>
                  {chosen.map((r) => <TableHead key={r.id} className="text-right">{r.name}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {([
                  ["Win rate", (r: SavedRun) => (r.summary.winRate !== null ? fmtPct(r.summary.winRate * 100, 0) : "—"), "winRate"],
                  ["Avg / trade", (r: SavedRun) => (r.summary.expectancyPct !== null ? fmtPct(r.summary.expectancyPct, 2, { sign: true }) : "—"), "expectancy"],
                  ["Profit factor", (r: SavedRun) => (r.summary.profitFactor !== null ? fmtNum(r.summary.profitFactor) : "—"), "profitFactor"],
                  ["On unseen data", (r: SavedRun) => (r.summary.unseenExpectancyPct != null ? fmtPct(r.summary.unseenExpectancyPct, 2, { sign: true }) : "—"), "unseen"],
                  ["Max drawdown", (r: SavedRun) => (r.summary.maxDrawdownPct != null ? fmtPct(-r.summary.maxDrawdownPct, 1) : "—"), "drawdown"],
                  ["Trades", (r: SavedRun) => String(r.summary.trades), null],
                ] as const).map(([label, f, key]) => (
                  <TableRow key={label}>
                    <TableCell className="pl-3 text-muted-foreground">{label}</TableCell>
                    {chosen.map((r) => (
                      <TableCell key={r.id} className={cn("text-right font-mono", key && best[key] === r.id && "font-semibold text-up")}>{f(r)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
