"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { NumberField } from "@/components/backtest/number-field";
import { SymbolLabel } from "@/components/symbol-label";
import { fmtDate, fmtInr, fmtPct } from "@/lib/format";
import { orderLabel } from "@/lib/paper/broker";
import type { PendingOrder } from "@/lib/paper/types";
import { cn } from "@/lib/utils";
import { usePaper } from "./paper-provider";

const REASON: Record<string, string> = { manual: "Exited", stop: "Stop-loss hit", target: "Target hit", squareoff: "Auto square-off" };
const EVENT_TONE: Record<string, string> = { filled: "text-up", rejected: "text-down", expired: "text-warn", cancelled: "text-muted-foreground", updated: "text-muted-foreground" };

function PendingRow({ o }: { o: PendingOrder }) {
  const { state, quotes, cancel, modify } = usePaper();
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(o.limitPrice);
  const [qty, setQty] = useState(o.qty);
  const held = state.positions.some((p) => p.symbol === o.symbol && p.direction === (o.side === "sell" ? "long" : "short") && p.product === o.product);
  const label = orderLabel(o.kind, held || (o.side === "sell" && o.product === "delivery"));
  const ltp = quotes[o.symbol]?.price;
  const away = ltp ? ((o.limitPrice - ltp) / ltp) * 100 : undefined;
  const until = o.validity === "day" ? "Today" : o.expiresAt ? `Until ${fmtDate(o.expiresAt)}` : "";

  async function save() {
    const r = await modify(o.id, { price, qty });
    if (r.error) toast.error(r.error);
    else { toast.success("Order updated"); setEditing(false); }
  }

  return (
    <div className="space-y-2 border-t px-4 py-3">
      <div className="flex items-center gap-3">
        <SymbolLabel symbol={o.symbol} className="flex-1" />
        <Badge variant="outline" className={o.side === "buy" ? "text-up" : "text-down"}>{o.side.toUpperCase()}</Badge>
        <div className="text-right">
          <div className="tabular font-mono text-sm">{o.qty} @ {o.limitPrice.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">{label} · {until}</div>
        </div>
        <div className="hidden w-24 text-right sm:block">
          {away !== undefined && <div className={cn("tabular font-mono text-xs", "text-muted-foreground")}>{fmtPct(away, 1, { sign: true })} away</div>}
          {ltp && <div className="tabular font-mono text-[11px] text-muted-foreground">LTP {ltp.toFixed(2)}</div>}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Edit order" onClick={() => setEditing((v) => !v)}><Pencil /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Cancel order" onClick={() => cancel(o.id)}><X /></Button>
      </div>
      {editing && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg bg-muted/40 p-3">
          <div className="w-32 space-y-1"><div className="text-xs text-muted-foreground">{o.kind === "stop" ? "Trigger" : "Limit price"}</div><NumberField min={0} step={0.05} value={price} onChange={setPrice} /></div>
          <div className="w-28 space-y-1"><div className="text-xs text-muted-foreground">Quantity</div><NumberField min={1} value={qty} onChange={(v) => setQty(Math.max(1, Math.round(v)))} /></div>
          <Button size="sm" onClick={save}><Check /> Save</Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setPrice(o.limitPrice); setQty(o.qty); }}>Cancel</Button>
        </div>
      )}
    </div>
  );
}

/** Pending orders first, then what happened to them, then executed exits, like the Orders tab of a broker app. */
export function OrdersPanel() {
  const { state } = usePaper();
  const done = [...state.trades].reverse().slice(0, 25);
  const events = [...(state.events ?? [])].reverse().slice(0, 15);
  return (
    <div className="space-y-4">
      <Card className="py-0">
        <CardHeader className="pt-4"><CardTitle>Pending ({state.orders.length})</CardTitle></CardHeader>
        {state.orders.length === 0 ? (
          <p className="px-4 pb-5 text-sm text-muted-foreground">No pending orders. Place a limit, take-profit or stop-loss order from the Trade page, or use Exits on a holding. They execute when the price hits.</p>
        ) : state.orders.map((o) => <PendingRow key={o.id} o={o} />)}
      </Card>

      {events.length > 0 && (
        <Card className="py-0">
          <CardHeader className="pt-4"><CardTitle>Activity</CardTitle></CardHeader>
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 border-t px-4 py-2.5 text-sm">
              <span className="w-28 shrink-0 pt-0.5 text-xs text-muted-foreground">{e.time ? fmtDate(e.time) : ""}</span>
              <span className={cn("flex-1", EVENT_TONE[e.kind])}>{e.text}</span>
            </div>
          ))}
        </Card>
      )}

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
