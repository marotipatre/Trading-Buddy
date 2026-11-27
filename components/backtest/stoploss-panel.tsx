import { Info } from "lucide-react";
import { Info as InfoPop } from "@/components/ui/info";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StopLossStudy, VariantStats } from "@/lib/engine/stoploss-study";
import { fmtInr, fmtNum, fmtPct } from "@/lib/format";
import { MaeMfeChart } from "./mae-mfe-chart";
import { MetricCard } from "./metric-card";
import { StopCompareChart } from "./stop-compare-chart";

function Row({ v, highlight }: { v: VariantStats; highlight?: boolean }) {
  return (
    <TableRow className={highlight ? "bg-primary/10" : undefined}>
      <TableCell className="font-medium">{v.label}</TableCell>
      <TableCell className="text-right font-mono">{fmtPct(v.winRate * 100, 0)}</TableCell>
      <TableCell className={`text-right font-mono ${v.totalPnl >= 0 ? "text-up" : "text-down"}`}>{fmtInr(v.totalPnl, { sign: true })}</TableCell>
      <TableCell className="text-right font-mono">{fmtPct(v.expectancyPct, 2, { sign: true })}</TableCell>
      <TableCell className="text-right font-mono">{fmtNum(v.profitFactor)}</TableCell>
      <TableCell className="text-right font-mono">{fmtPct(v.worstTradePct, 1)}</TableCell>
      <TableCell className="text-right font-mono">{fmtPct(-v.maxDrawdownPct, 1)}</TableCell>
      <TableCell className="text-right font-mono">{v.stoppedOut}/{v.trades}</TableCell>
    </TableRow>
  );
}

export function StopLossPanel({ s }: { s: StopLossStudy }) {
  const all = [s.none, ...(s.user ? [s.user] : []), ...s.grid];
  const helps = s.verdict.includes("is helping");
  return (
    <div className="space-y-4">
      <Card className={helps ? "border-up/40" : s.user ? "border-warn/40" : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Is your stop-loss helping?
            {s.user && <Badge variant={helps ? "default" : "destructive"}>{helps ? "Helping" : "Costing you"}</Badge>}
          </CardTitle>
          <CardDescription>Same entries replayed with and without stops; only the stop changes</CardDescription>
        </CardHeader>
        <CardContent><p className="text-sm leading-relaxed">{s.verdict}</p></CardContent>
      </Card>

      {s.impact && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Stopped out" value={`${s.impact.stoppedTrades}`} sub={`of ${s.entries} trades`} />
          <MetricCard label="Would have recovered" value={`${s.impact.wouldHaveRecovered}`}
            sub="ended profitable with no stop" tone={s.impact.wouldHaveRecovered > s.impact.stoppedTrades / 2 ? "warn" : undefined} />
          <MetricCard label="Loss saved" value={fmtInr(s.impact.lossSaved)} sub="vs holding on" tone="up" />
          <MetricCard label="Profit given up" value={fmtInr(s.impact.profitForgone)} sub="trades that came back" tone="down" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">Total P&amp;L by stop setting<InfoPop title="Total PandL by stop setting"><p>Bars above the dashed line beat having no stop. Prefer a wide, flat range of good values over one lucky peak.</p></InfoPop></CardTitle>
        </CardHeader>
        <CardContent>
          <StopCompareChart variants={[...(s.user ? [s.user] : []), ...s.grid]} baseline={s.none} userLabel={s.user?.label} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">How far do trades dip against you?<InfoPop title="How far do trades dip against you?"><p>Without a stop, 90% of eventual winners dipped up to <b>{fmtPct(s.winnersMaeP90, 1)}</b> first. A stop tighter than that would have closed most of them early. The median losing trade had run <b>{fmtPct(s.losersMedianMfePct, 1)}</b> in profit before reversing.</p></InfoPop></CardTitle>
        </CardHeader>
        <CardContent>
          <MaeMfeChart points={s.scatter} stopPct={s.user?.stop?.type === "percent" ? s.user.stop.value : undefined} />
        </CardContent>
      </Card>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Variant</TableHead>
              <TableHead className="text-right">Win rate</TableHead>
              <TableHead className="text-right">Total P&amp;L</TableHead>
              <TableHead className="text-right">Avg / trade</TableHead>
              <TableHead className="text-right">Profit factor</TableHead>
              <TableHead className="text-right">Worst trade</TableHead>
              <TableHead className="text-right">Max DD</TableHead>
              <TableHead className="pr-4 text-right">Stopped</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {all.map((v) => <Row key={v.label} v={v} highlight={v === s.user} />)}
          </TableBody>
        </Table>
      </Card>

      <ul className="space-y-1 text-xs text-muted-foreground">
        {s.caveats.map((c) => (
          <li key={c} className="flex gap-2"><Info className="mt-0.5 size-3.5 shrink-0" />{c}</li>
        ))}
      </ul>
    </div>
  );
}
