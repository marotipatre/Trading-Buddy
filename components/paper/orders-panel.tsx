"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { SymbolLabel } from "@/components/symbol-label";
import { fmtDate, fmtInr } from "@/lib/format";
import { usePaper } from "./paper-provider";

const REASON: Record<string, string> = { manual: "Exited", stop: "Stop-loss hit", target: "Target hit", squareoff: "Auto square-off" };

/** Pending orders first, then recently executed exits, like the Orders tab of a broker app. */
export function OrdersPanel() {
  const { state, cancel } = usePaper();
  const done = [...state.trades].reverse().slice(0, 25);
  return (
    <div className="space-y-4">
      <Card className="py-0">
        <CardHeader className="pt-4"><CardTitle>Pending ({state.orders.length})</CardTitle></CardHeader>
        {state.orders.length === 0 ? (
          <p className="px-4 pb-5 text-sm text-muted-foreground">No pending orders. Limit orders that have not reached their price wait here.</p>
        ) : state.orders.map((o) => (
          <div key={o.id} className="flex items-center gap-3 border-t px-4 py-3">
            <SymbolLabel symbol={o.symbol} className="flex-1" />
            <Badge variant="outline" className={o.side === "buy" ? "text-up" : "text-down"}>{o.side.toUpperCase()}</Badge>
            <div className="tabular text-right font-mono text-sm">{o.qty} @ {o.limitPrice.toFixed(2)}</div>
            <Button variant="ghost" size="icon-sm" aria-label="Cancel order" onClick={() => cancel(o.id)}><X /></Button>
          </div>
        ))}
      </Card>
      <Card className="py-0">
        <CardHeader className="pt-4"><CardTitle>Executed ({state.trades.length})</CardTitle></CardHeader>
        {done.length === 0 ? (
          <p className="px-4 pb-5 text-sm text-muted-foreground">Closed trades appear here.</p>
        ) : done.map((t) => (
          <div key={t.id} className="flex items-center gap-3 border-t px-4 py-3">
            <SymbolLabel symbol={t.symbol} className="flex-1" />
            <div className="hidden text-xs text-muted-foreground sm:block">{fmtDate(t.exitTime)}</div>
            <Badge variant="secondary">{REASON[t.reason] ?? t.reason}</Badge>
            <div className="tabular text-right font-mono text-sm">{t.qty} @ {t.exitPrice.toFixed(2)}</div>
            <div className={`tabular w-24 text-right font-mono text-sm ${t.netPnl >= 0 ? "text-up" : "text-down"}`}>{fmtInr(t.netPnl, { sign: true })}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}
