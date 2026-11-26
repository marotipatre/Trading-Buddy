"use client";

import { X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtInr, fmtPct } from "@/lib/format";
import { usePaper } from "./paper-provider";

export function PositionsPanel() {
  const { state, quotes, closeNow, cancel } = usePaper();
  return (
    <div className="space-y-4">
      <Card className="py-0">
        <CardHeader className="pt-4"><CardTitle>Open positions ({state.positions.length})</CardTitle></CardHeader>
        {state.positions.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">No open positions. Place an order from the Chart page.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Symbol</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Avg</TableHead>
                <TableHead className="text-right">LTP</TableHead>
                <TableHead className="text-right">P&amp;L</TableHead>
                <TableHead className="text-right">Stop</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.positions.map((p) => {
                const ltp = quotes[p.symbol]?.price ?? p.entryPrice;
                const sign = p.direction === "long" ? 1 : -1;
                const pnl = sign * (ltp - p.entryPrice) * p.qty;
                const pct = (sign * (ltp - p.entryPrice)) / p.entryPrice * 100;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="pl-4">
                      <div className="font-medium">{p.symbol}</div>
                      <div className="flex gap-1 text-[11px] text-muted-foreground">
                        <Badge variant="outline">{p.direction}</Badge><Badge variant="outline">{p.product === "delivery" ? "CNC" : "MIS"}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{p.qty}</TableCell>
                    <TableCell className="text-right font-mono">{p.entryPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">{ltp.toFixed(2)}</TableCell>
                    <TableCell className={`text-right font-mono ${pnl >= 0 ? "text-up" : "text-down"}`}>
                      {fmtInr(pnl, { sign: true })}<div className="text-[11px]">{fmtPct(pct, 2, { sign: true })}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{p.stop ? p.stop.toFixed(2) : "—"}{p.trailDist ? " ↑" : ""}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{p.target ? p.target.toFixed(2) : "—"}</TableCell>
                    <TableCell className="pr-2">
                      <Button variant="outline" size="xs" onClick={async () => {
                        const r = await closeNow(p.id);
                        if (r.error) toast.error(r.error); else toast.success(`Closed ${p.symbol}`);
                      }}>Close</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {state.orders.length > 0 && (
        <Card className="py-0">
          <CardHeader className="pt-4"><CardTitle>Pending orders ({state.orders.length})</CardTitle></CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Symbol</TableHead><TableHead>Side</TableHead>
                <TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Limit</TableHead><TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="pl-4 font-medium">{o.symbol}</TableCell>
                  <TableCell><Badge variant="outline">{o.side}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{o.qty}</TableCell>
                  <TableCell className="text-right font-mono">{o.limitPrice.toFixed(2)}</TableCell>
                  <TableCell className="pr-2"><Button variant="ghost" size="icon-sm" aria-label="Cancel order" onClick={() => cancel(o.id)}><X /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
