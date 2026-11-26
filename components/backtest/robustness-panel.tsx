import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Analysis } from "@/lib/engine/analyze";
import type { Metrics } from "@/lib/engine/metrics";
import { fmtDate, fmtNum, fmtPct } from "@/lib/format";
import { MetricCard } from "./metric-card";
import { McRange } from "./mc-range";

function OosRow({ label, m }: { label: string; m: Metrics }) {
  return (
    <TableRow>
      <TableCell className="pl-4 font-medium">{label}</TableCell>
      <TableCell className="text-right font-mono">{m.trades}</TableCell>
      <TableCell className="text-right font-mono">{fmtPct(m.winRate * 100, 0)}</TableCell>
      <TableCell className="text-right font-mono">{fmtPct(m.expectancyPct, 2, { sign: true })}</TableCell>
      <TableCell className="text-right font-mono">{fmtNum(m.profitFactor)}</TableCell>
      <TableCell className="pr-4 text-right font-mono">{fmtPct(-m.maxDrawdownPct, 1)}</TableCell>
    </TableRow>
  );
}

export function RobustnessPanel({ a }: { a: Analysis }) {
  const mc = a.monteCarlo;
  const oos = a.outOfSample;
  return (
    <div className="space-y-4">
      {mc ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Chance of profit" value={fmtPct(mc.probProfit * 100, 0)} sub={`${mc.sims.toLocaleString()} simulated paths`} tone={mc.probProfit >= 0.7 ? "up" : "warn"} />
            <MetricCard label={`Chance of ${mc.ruinDrawdownPct}% drawdown`} value={fmtPct(mc.probRuin * 100, 1)} tone={mc.probRuin > 0.1 ? "down" : undefined} />
            <MetricCard label="Typical worst drawdown" value={fmtPct(-mc.maxDrawdownPct.median, 0)} sub="median across paths" />
            <MetricCard label="Bad-luck drawdown" value={fmtPct(-mc.maxDrawdownPct.p95, 0)} sub="95th percentile" tone="down" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Range of outcomes</CardTitle>
              <CardDescription>
                Your {mc.tradesPerPath} trades reshuffled and resampled thousands of times. Thin line: 5th–95th percentile. Box: middle half. Vertical bar: median.
              </CardDescription>
            </CardHeader>
            <CardContent><McRange mc={mc} /></CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No trades to simulate.</p>
      )}

      <Card className="py-0">
        <CardHeader className="pt-4">
          <CardTitle>In-sample vs out-of-sample</CardTitle>
          <CardDescription>
            {oos ? `Trades before ${fmtDate(oos.splitTime)} versus after. A real edge should survive the second half.` : "Not enough trades to split the history."}
          </CardDescription>
        </CardHeader>
        {oos && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Period</TableHead>
                <TableHead className="text-right">Trades</TableHead>
                <TableHead className="text-right">Win rate</TableHead>
                <TableHead className="text-right">Avg / trade</TableHead>
                <TableHead className="text-right">Profit factor</TableHead>
                <TableHead className="pr-4 text-right">Max DD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <OosRow label="In-sample (earlier)" m={oos.inSample} />
              <OosRow label="Out-of-sample (later)" m={oos.outSample} />
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
