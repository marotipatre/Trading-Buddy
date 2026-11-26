"use client";

import { Info } from "@/components/ui/info";
import { useMemo } from "react";
import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetricCard } from "@/components/backtest/metric-card";
import { fmtInr, fmtNum, fmtPct } from "@/lib/format";
import { computeInsights, type GroupStat } from "@/lib/paper/insights";
import { usePaper } from "./paper-provider";
import { displaySymbol } from "@/lib/symbols";

function Groups({ title, rows }: { title: string; rows: GroupStat[] }) {
  if (!rows.length) return null;
  return (
    <Card className="py-0">
      <CardHeader className="pt-4"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4" />
            <TableHead className="text-right">Trades</TableHead><TableHead className="text-right">Win rate</TableHead>
            <TableHead className="text-right">Avg return</TableHead><TableHead className="pr-4 text-right">Total P&amp;L</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((g) => (
            <TableRow key={g.key}>
              <TableCell className="pl-4 font-medium">{title === "By stock" ? displaySymbol(g.key) : g.key}</TableCell>
              <TableCell className="text-right font-mono">{g.n}</TableCell>
              <TableCell className="text-right font-mono">{fmtPct(g.winRate * 100, 0)}</TableCell>
              <TableCell className="text-right font-mono">{fmtPct(g.avgReturnPct, 2, { sign: true })}</TableCell>
              <TableCell className={`pr-4 text-right font-mono ${g.totalPnl >= 0 ? "text-up" : "text-down"}`}>{fmtInr(g.totalPnl, { sign: true })}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export function InsightsPanel() {
  const { state } = usePaper();
  const i = useMemo(() => computeInsights(state), [state]);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">How you&apos;re doing<Info title="How you&apos;re doing"><p>Findings from your own closed paper trades. They get sharper as the trade count grows.</p></Info></CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5">
            {i.tips.map((t) => (
              <li key={t} className="flex gap-2.5 text-sm leading-relaxed"><Lightbulb className="mt-0.5 size-4 shrink-0 text-warn" />{t}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {i.n >= 3 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Trades with a stop" value={fmtPct(i.stopUsagePct, 0)} sub={`${i.withStop} of ${i.n}`} tone={i.stopUsagePct >= 80 ? "up" : "warn"} />
          <MetricCard label="Expectancy" value={i.expectancyR !== undefined ? `${fmtNum(i.expectancyR, 2)} R` : "—"} sub="avg result per unit risked" tone={(i.expectancyR ?? 0) > 0 ? "up" : "down"} />
          <MetricCard label="Avg win / avg loss" value={i.avgWinR !== undefined && i.avgLossR !== undefined ? `${fmtNum(i.avgWinR, 1)}R / ${fmtNum(i.avgLossR, 1)}R` : "—"} sub={i.worstLossR !== undefined ? `Worst loss ${fmtNum(i.worstLossR, 1)}R` : undefined} />
          <MetricCard label="Winners given back" value={i.gaveBack.of ? `${i.gaveBack.count}/${i.gaveBack.of}` : "—"} sub="losers that were 1R up first" tone={i.gaveBack.of && i.gaveBack.count / i.gaveBack.of >= 0.3 ? "warn" : undefined} />
        </div>
      )}

      {i.n >= 3 && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Groups title="By how the trade ended" rows={i.byExit} />
          <Groups title="By your tags" rows={i.byTag} />
          <Groups title="By stock" rows={i.bySymbol} />
          <Groups title="By product" rows={i.byProduct} />
        </div>
      )}
    </div>
  );
}
