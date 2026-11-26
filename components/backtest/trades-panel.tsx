import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Trade } from "@/lib/engine/types";
import { fmtDate, fmtInr, fmtNum, fmtPct } from "@/lib/format";

export function TradesPanel({ trades }: { trades: Trade[] }) {
  if (!trades.length) return <p className="text-sm text-muted-foreground">The strategy took no trades on this history.</p>;
  return (
    <Card className="py-0">
      <ScrollArea className="h-[560px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Entry</TableHead>
              <TableHead>Exit</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Buy</TableHead>
              <TableHead className="text-right">Sell</TableHead>
              <TableHead className="text-right">Net P&amp;L</TableHead>
              <TableHead className="text-right">Return</TableHead>
              <TableHead className="text-right">R</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead className="text-right">Dip / Run</TableHead>
              <TableHead className="pr-4">Why</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((t, i) => (
              <TableRow key={i}>
                <TableCell className="pl-4 text-xs">{fmtDate(t.entryTime)}</TableCell>
                <TableCell className="text-xs">{fmtDate(t.exitTime)}</TableCell>
                <TableCell className="text-right font-mono">{t.qty}</TableCell>
                <TableCell className="text-right font-mono">{t.entryPrice.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono">{t.exitPrice.toFixed(2)}</TableCell>
                <TableCell className={`text-right font-mono ${t.netPnl >= 0 ? "text-up" : "text-down"}`}>{fmtInr(t.netPnl, { sign: true })}</TableCell>
                <TableCell className={`text-right font-mono ${t.returnPct >= 0 ? "text-up" : "text-down"}`}>{fmtPct(t.returnPct, 2, { sign: true })}</TableCell>
                <TableCell className="text-right font-mono">{fmtNum(t.rMultiple, 1)}</TableCell>
                <TableCell className="text-right font-mono">{t.barsHeld}</TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">-{t.maePct.toFixed(1)}% / +{t.mfePct.toFixed(1)}%</TableCell>
                <TableCell className="pr-4"><Badge variant="outline">{t.exitReason}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </Card>
  );
}
