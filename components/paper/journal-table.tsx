"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, fmtInr, fmtPct } from "@/lib/format";
import { usePaper } from "./paper-provider";

export function JournalTable() {
  const { state } = usePaper();
  const rows = [...state.trades].reverse();
  return (
    <Card className="py-0">
      <CardHeader className="pt-4"><CardTitle>Trade journal ({rows.length})</CardTitle></CardHeader>
      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">Closed trades appear here with charges included.</p>
      ) : (
        <ScrollArea className="max-h-96">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Closed</TableHead><TableHead>Symbol</TableHead>
                <TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Entry</TableHead><TableHead className="text-right">Exit</TableHead>
                <TableHead className="text-right">Charges</TableHead><TableHead className="text-right">Net P&amp;L</TableHead><TableHead className="pr-4">Why</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="pl-4 text-xs">{fmtDate(t.exitTime)}</TableCell>
                  <TableCell className="font-medium">{t.symbol}</TableCell>
                  <TableCell className="text-right font-mono">{t.qty}</TableCell>
                  <TableCell className="text-right font-mono">{t.entryPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">{t.exitPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{fmtInr(t.charges)}</TableCell>
                  <TableCell className={`text-right font-mono ${t.netPnl >= 0 ? "text-up" : "text-down"}`}>
                    {fmtInr(t.netPnl, { sign: true })}<div className="text-[11px]">{fmtPct(t.returnPct, 2, { sign: true })}</div>
                  </TableCell>
                  <TableCell className="pr-4"><Badge variant="outline">{t.reason}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </Card>
  );
}
