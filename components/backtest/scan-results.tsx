"use client";

import { AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SymbolLabel } from "@/components/symbol-label";
import { fmtInr, fmtNum, fmtPct } from "@/lib/format";
import type { GroupStat, PooledStats, ScanRow, ScanSummary } from "@/lib/engine/scan";
import { MetricCard } from "./metric-card";

function GroupTable({ title, rows }: { title: string; rows: GroupStat[] }) {
  if (!rows.length) return null;
  return (
    <Card className="py-0">
      <CardHeader className="pt-4"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4" />
            <TableHead className="text-right">Stocks</TableHead><TableHead className="text-right">Trades</TableHead>
            <TableHead className="text-right">Win rate</TableHead><TableHead className="text-right">Avg / trade</TableHead>
            <TableHead className="pr-4 text-right">Median return</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((g) => (
            <TableRow key={g.key}>
              <TableCell className="pl-4 font-medium">{g.key}</TableCell>
              <TableCell className="text-right font-mono">{g.symbols}</TableCell>
              <TableCell className="text-right font-mono">{g.trades}</TableCell>
              <TableCell className="text-right font-mono">{fmtPct(g.winRate * 100, 0)}</TableCell>
              <TableCell className={`text-right font-mono ${g.expectancyPct >= 0 ? "text-up" : "text-down"}`}>{fmtPct(g.expectancyPct, 2, { sign: true })}</TableCell>
              <TableCell className={`pr-4 text-right font-mono ${g.medianReturnPct >= 0 ? "text-up" : "text-down"}`}>{fmtPct(g.medianReturnPct, 1, { sign: true })}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function SampleRow({ label, p }: { label: string; p: PooledStats }) {
  return (
    <TableRow>
      <TableCell className="pl-4 font-medium">{label}</TableCell>
      <TableCell className="text-right font-mono">{p.trades}</TableCell>
      <TableCell className="text-right font-mono">{fmtPct(p.winRate * 100, 0)}</TableCell>
      <TableCell className={`text-right font-mono ${p.expectancyPct >= 0 ? "text-up" : "text-down"}`}>{fmtPct(p.expectancyPct, 2, { sign: true })}</TableCell>
      <TableCell className="pr-4 text-right font-mono">{fmtNum(p.profitFactor)}</TableCell>
    </TableRow>
  );
}

export function ScanResults({ summary: s, rows, failed, label }: { summary: ScanSummary; rows: ScanRow[]; failed: { symbol: string; error: string }[]; label: string }) {
  const p = s.pooled;
  const [lo, hi] = p.winRateCI;
  const sorted = [...rows].sort((a, b) => b.metrics.expectancyPct - a.metrics.expectancyPct);
  const stopDelta = s.stop ? s.stop.totalUser - s.stop.totalNone : 0;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{label}</h2>

      {s.warnings.length > 0 && (
        <div className="space-y-1 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
          {s.warnings.map((w) => <p key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{w}</p>)}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Win probability" value={fmtPct(p.winRate * 100, 0)} sub={`95% range ${fmtPct(lo * 100, 0)} – ${fmtPct(hi * 100, 0)} · ${p.wins}/${p.trades} trades`} tone={p.winRate >= 0.5 ? "up" : undefined} />
        <MetricCard label="Expectancy / trade" value={fmtPct(p.expectancyPct, 2, { sign: true })} sub={`avg win ${fmtPct(p.avgWinPct, 1)} · avg loss ${fmtPct(p.avgLossPct, 1)}`} tone={p.expectancyPct > 0 ? "up" : "down"} />
        <MetricCard label="Profit factor" value={fmtNum(p.profitFactor)} sub="across every trade in the group" tone={p.profitFactor > 1 ? "up" : "down"} />
        <MetricCard label="Stocks that made money" value={fmtPct(s.profitableShare * 100, 0)} sub={`of ${s.symbols} stocks`} tone={s.profitableShare >= 0.6 ? "up" : "warn"} />
        <MetricCard label="Beat buy & hold" value={fmtPct(s.beatBuyHoldShare * 100, 0)} sub={`median ${fmtPct(s.medianStrategyReturnPct, 0, { sign: true })} vs ${fmtPct(s.medianBuyHoldPct, 0, { sign: true })} for holding`} tone={s.beatBuyHoldShare >= 0.5 ? "up" : "warn"} />
      </div>

      <Card className="py-0">
        <CardHeader className="pt-4">
          <CardTitle>Does the edge survive?</CardTitle>
          <CardDescription>Earlier 70% of each stock&apos;s history versus the later 30%, pooled across the group</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Period</TableHead><TableHead className="text-right">Trades</TableHead>
              <TableHead className="text-right">Win rate</TableHead><TableHead className="text-right">Avg / trade</TableHead>
              <TableHead className="pr-4 text-right">Profit factor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <SampleRow label="Earlier (in-sample)" p={s.inSample} />
            <SampleRow label="Later (out-of-sample)" p={s.outSample} />
          </TableBody>
        </Table>
      </Card>

      {s.stop && (
        <Card>
          <CardHeader>
            <CardTitle>Is your stop-loss helping, across the group?</CardTitle>
            <CardDescription>The same entries replayed with and without your stop, summed over {s.stop.stocks} stocks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm leading-relaxed">
            <p>
              Without a stop: <b className="font-mono">{fmtInr(s.stop.totalNone, { sign: true })}</b>. With your stop: <b className="font-mono">{fmtInr(s.stop.totalUser, { sign: true })}</b>.
              The stop {stopDelta >= 0 ? "added" : "cost"} <b className="font-mono">{fmtInr(Math.abs(stopDelta))}</b> and came out ahead on <b>{s.stop.helped} of {s.stop.stocks}</b> stocks.
            </p>
            <p className="flex gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" />Fixed notional per trade; overlapping trades allowed. Compare with the single-stock stop study for details such as how far winners dip.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 2xl:grid-cols-2">
        <GroupTable title="By sector" rows={s.bySector} />
        <GroupTable title="By size class" rows={s.byCap.map((g) => ({ ...g, key: g.key[0].toUpperCase() + g.key.slice(1) + " cap" }))} />
      </div>

      <Card className="py-0">
        <CardHeader className="pt-4">
          <CardTitle>Every stock</CardTitle>
          <CardDescription>Best average result first. One stock&apos;s luck proves nothing; the pattern across stocks does.</CardDescription>
        </CardHeader>
        <ScrollArea className="h-[420px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Stock</TableHead><TableHead className="text-right">Trades</TableHead>
                <TableHead className="text-right">Win rate</TableHead><TableHead className="text-right">Avg / trade</TableHead>
                <TableHead className="text-right">Strategy</TableHead><TableHead className="pr-4 text-right">Buy &amp; hold</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.symbol}>
                  <TableCell className="pl-4"><SymbolLabel symbol={r.symbol} name={r.sector ? `${r.name ?? ""}${r.name ? " · " : ""}${r.sector}` : r.name} /></TableCell>
                  <TableCell className="text-right font-mono">{r.metrics.trades}</TableCell>
                  <TableCell className="text-right font-mono">{r.metrics.trades ? fmtPct(r.metrics.winRate * 100, 0) : "—"}</TableCell>
                  <TableCell className={`text-right font-mono ${r.metrics.expectancyPct >= 0 ? "text-up" : "text-down"}`}>{r.metrics.trades ? fmtPct(r.metrics.expectancyPct, 2, { sign: true }) : "—"}</TableCell>
                  <TableCell className={`text-right font-mono ${r.metrics.totalReturnPct >= 0 ? "text-up" : "text-down"}`}>{fmtPct(r.metrics.totalReturnPct, 0, { sign: true })}</TableCell>
                  <TableCell className="pr-4 text-right font-mono text-muted-foreground">{fmtPct(r.buyHoldPct, 0, { sign: true })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {failed.length > 0 && (
        <p className="text-xs text-muted-foreground">{failed.length} stock{failed.length > 1 ? "s" : ""} could not be tested: {failed.map((f) => `${f.symbol} (${f.error})`).join("; ")}</p>
      )}
    </div>
  );
}
