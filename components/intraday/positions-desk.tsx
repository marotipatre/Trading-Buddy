"use client";

import { useMemo, useState } from "react";
import { Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { NumberField } from "@/components/backtest/number-field";
import { Collapse, Count, Money, Percent, Stagger, StaggerItem } from "@/components/motion/primitives";
import { Button } from "@/components/ui/button";
import { fmtInr } from "@/lib/format";
import { displaySymbol } from "@/lib/symbols";
import { cn } from "@/lib/utils";
import { useNow } from "@/components/use-now";
import { useIntraday } from "./intraday-provider";

const istDay = (t: number) => Math.floor((t + 19800) / 86400);
const KIND = { limit: "Limit", stop: "Stop" } as const;
const REASON: Record<string, string> = { stop: "Stop-loss", target: "Target", manual: "Exited by you", squareoff: "Auto square-off", expired: "Expired" };

/** The positions screen of a trading app: live profit and loss per position, edit stop-loss and target, exit one or all, and manage pending orders. */
export function PositionsDesk({ onGoToPicks }: { onGoToPicks: () => void }) {
  const { acc, quotes, closeNow, cancel, modify, setExits, exitAll } = useIntraday();
  const [editing, setEditing] = useState<number | null>(null);
  const [orderEdit, setOrderEdit] = useState<number | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const positions = acc?.state.positions ?? [];
  const orders = acc?.state.orders ?? [];
  const now = useNow();
  const today = useMemo(() => (acc ? acc.state.trades.filter((t) => istDay(t.exitTime) === istDay(now)).sort((a, b) => b.exitTime - a.exitTime) : []), [acc, now]);

  const rows = positions.map((p) => {
    const q = quotes[p.symbol];
    const ltp = q?.price ?? p.entryPrice;
    const sgn = p.direction === "long" ? 1 : -1;
    const pnl = sgn * (ltp - p.entryPrice) * p.qty;
    return { p, q, ltp, pnl, pnlPct: (sgn * (ltp / p.entryPrice - 1)) * 100, value: p.qty * ltp };
  });
  const openPnl = rows.reduce((s, r) => s + r.pnl, 0);
  const invested = rows.reduce((s, r) => s + r.p.qty * r.p.entryPrice, 0);
  const realisedToday = today.reduce((s, t) => s + t.netPnl, 0);
  const held = orders.reduce((s, o) => s + o.qty * o.limitPrice, 0);

  async function onExit(id: number) { const r = await closeNow(id); if (r.error) toast.error(r.error); else toast.success("Position closed"); }
  async function onExitAll() {
    if (!confirmAll) { setConfirmAll(true); setTimeout(() => setConfirmAll(false), 4000); return; }
    setConfirmAll(false);
    const r = await exitAll();
    if (r.error) toast.error(r.error); else toast.success(`Closed ${r.closed} position${r.closed === 1 ? "" : "s"}`);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
        {([
          ["Open P&L", <Money key="a" value={openPnl} sign className={cn("figure text-xl", openPnl > 0 ? "text-up" : openPnl < 0 ? "text-down" : "")} />, invested > 0 ? <Percent key="a2" value={(openPnl / invested) * 100} className="text-xs text-muted-foreground" /> : "no open trades"],
          ["Booked today", <Money key="b" value={realisedToday} sign className={cn("figure text-xl", realisedToday > 0 ? "text-up" : realisedToday < 0 ? "text-down" : "")} />, `${today.length} closed trade${today.length === 1 ? "" : "s"}`],
          ["Invested", <Money key="c" value={invested} className="figure text-xl" />, `${positions.length} position${positions.length === 1 ? "" : "s"}`],
          ["Held by orders", <Money key="d" value={held} className="figure text-xl" />, `${orders.length} pending order${orders.length === 1 ? "" : "s"}`],
        ] as const).map(([label, value, sub]) => (
          <div key={label} className="bg-card px-4 py-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-0.5">{value}</div><div className="text-xs text-muted-foreground">{sub}</div></div>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Positions <span className="text-sm font-normal text-muted-foreground">({positions.length})</span></h2>
          {positions.length > 0 && <Button size="sm" variant={confirmAll ? "destructive" : "outline"} className="ml-auto" onClick={onExitAll}>{confirmAll ? "Click again to exit all" : "Exit all"}</Button>}
        </div>
        {positions.length === 0 ? (
          <div className="rounded-2xl border bg-card px-6 py-10 text-center">
            <p className="font-medium">No open positions</p>
            <p className="mt-1 text-sm text-muted-foreground">Orders you place from the picks appear here once they fill, with live profit and loss.</p>
            <Button className="mt-4" onClick={onGoToPicks}>See today&apos;s picks</Button>
          </div>
        ) : (
          <Stagger className="space-y-3">
            {rows.map(({ p, q, ltp, pnl, pnlPct, value }) => {
              const sgn = p.direction === "long" ? 1 : -1;
              return (
                <StaggerItem key={p.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div className="min-w-32">
                      <div className="flex items-center gap-2"><span className="font-heading text-lg font-semibold leading-tight">{displaySymbol(p.symbol)}</span>
                        <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", sgn > 0 ? "bg-up/10 text-up" : "bg-down/10 text-down")}>{sgn > 0 ? "Long" : "Short"}</span></div>
                      <div className="text-xs text-muted-foreground">{p.qty} shares · {fmtInr(value)}</div>
                    </div>
                    <div className="text-sm"><div className="text-xs text-muted-foreground">Average</div><div className="figure">{p.entryPrice.toFixed(2)}</div></div>
                    <div className="text-sm"><div className="text-xs text-muted-foreground">Last price</div><div className="flex items-baseline gap-1.5"><Count value={ltp} decimals={2} className="figure" />{q && <Percent value={q.changePct} className={cn("text-xs", q.changePct >= 0 ? "text-up" : "text-down")} />}</div></div>
                    <div className="ml-auto text-right"><Money value={pnl} sign decimals={2} className={cn("figure text-xl", pnl >= 0 ? "text-up" : "text-down")} /><div><Percent value={pnlPct} className={cn("text-xs", pnl >= 0 ? "text-up" : "text-down")} /></div></div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-3 text-sm">
                    <span className="text-muted-foreground">Stop-loss <b className="figure text-down">{p.stop ? p.stop.toFixed(2) : "none"}</b></span>
                    <span className="text-muted-foreground">Target <b className="figure text-up">{p.target ? p.target.toFixed(2) : "none"}</b></span>
                    <button type="button" onClick={() => setEditing(editing === p.id ? null : p.id)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Pencil className="size-3" />{editing === p.id ? "Close" : "Edit stop and target"}</button>
                    <Button size="sm" variant="outline" className="ml-auto" onClick={() => void onExit(p.id)}>Exit position</Button>
                  </div>
                  <Collapse open={editing === p.id}><ExitEditor key={p.id} pos={p} ltp={ltp} onSave={async (e) => { const r = await setExits(p.id, e); if (r.error) toast.error(r.error); else { toast.success("Stop-loss and target updated"); setEditing(null); } }} /></Collapse>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pending orders <span className="text-sm font-normal text-muted-foreground">({orders.length})</span></h2>
        {orders.length === 0 ? <p className="rounded-2xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">No pending orders.</p> : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {orders.map((o) => (
              <li key={o.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  <div className="min-w-28"><span className="font-semibold">{displaySymbol(o.symbol)}</span> <span className={cn("ml-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", o.side === "buy" ? "bg-up/10 text-up" : "bg-down/10 text-down")}>{o.side === "buy" ? "Buy" : "Sell"}</span></div>
                  <span className="text-muted-foreground">{KIND[o.kind ?? "limit"]} · {o.qty} @ <b className="figure text-foreground">{o.limitPrice.toFixed(2)}</b></span>
                  <span className="text-xs text-muted-foreground">{o.validity === "day" ? "Today only" : "Until cancelled"} · holds {fmtInr(o.qty * o.limitPrice)}</span>
                  <div className="ml-auto flex gap-1.5">
                    <Button size="xs" variant="outline" onClick={() => setOrderEdit(orderEdit === o.id ? null : o.id)}>Modify</Button>
                    <Button size="xs" variant="ghost" onClick={() => cancel(o.id)}><X />Cancel</Button>
                  </div>
                </div>
                <Collapse open={orderEdit === o.id}><OrderEditor key={o.id} price={o.limitPrice} qty={o.qty} onSave={async (patch) => { const r = await modify(o.id, patch); if (r.error) toast.error(r.error); else { toast.success("Order updated"); setOrderEdit(null); } }} /></Collapse>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Today&apos;s closed trades <span className="text-sm font-normal text-muted-foreground">({today.length})</span></h2>
        {today.length === 0 ? <p className="rounded-2xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">Nothing closed yet today.</p> : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {today.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2.5 text-sm">
                <span className="min-w-28 font-semibold">{displaySymbol(t.symbol)} <span className="text-xs font-normal text-muted-foreground">{t.direction === "long" ? "Long" : "Short"}</span></span>
                <span className="text-muted-foreground">{t.qty} · {t.entryPrice.toFixed(2)} → {t.exitPrice.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">{REASON[t.reason] ?? t.reason}</span>
                <span className={cn("figure ml-auto", t.netPnl >= 0 ? "text-up" : "text-down")}>{fmtInr(t.netPnl, { sign: true })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ExitEditor({ pos, ltp, onSave }: { pos: { stop?: number; target?: number; direction: "long" | "short" }; ltp: number; onSave: (e: { stop: number | null; target: number | null }) => void }) {
  const [stop, setStop] = useState(pos.stop ?? 0);
  const [target, setTarget] = useState(pos.target ?? 0);
  const long = pos.direction === "long";
  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-muted/50 p-3">
      <label className="w-32 space-y-1"><span className="text-xs text-muted-foreground">Stop-loss ({long ? "below" : "above"} {ltp.toFixed(2)})</span><NumberField min={0} step={0.05} value={stop} onChange={setStop} /></label>
      <label className="w-32 space-y-1"><span className="text-xs text-muted-foreground">Target ({long ? "above" : "below"} {ltp.toFixed(2)})</span><NumberField min={0} step={0.05} value={target} onChange={setTarget} /></label>
      <Button size="sm" onClick={() => onSave({ stop: stop > 0 ? stop : null, target: target > 0 ? target : null })}>Save</Button>
      <span className="text-xs text-muted-foreground">Enter 0 to remove one.</span>
    </div>
  );
}

function OrderEditor({ price, qty, onSave }: { price: number; qty: number; onSave: (p: { price: number; qty: number }) => void }) {
  const [p, setP] = useState(price);
  const [q, setQ] = useState(qty);
  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-muted/50 p-3">
      <label className="w-32 space-y-1"><span className="text-xs text-muted-foreground">Price</span><NumberField min={0.05} step={0.05} value={p} onChange={setP} /></label>
      <label className="w-28 space-y-1"><span className="text-xs text-muted-foreground">Quantity</span><NumberField min={1} step={1} value={q} onChange={(v) => setQ(Math.round(v))} /></label>
      <Button size="sm" onClick={() => onSave({ price: p, qty: q })}>Update order</Button>
    </div>
  );
}
