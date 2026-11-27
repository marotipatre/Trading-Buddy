"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/backtest/number-field";
import { Percent } from "@/components/motion/primitives";
import type { IntradayPick } from "@/lib/intraday/picks";
import { fmtInr } from "@/lib/format";
import { intradayBreakEven } from "@/lib/playbook/calc";
import { displaySymbol } from "@/lib/symbols";
import { cn } from "@/lib/utils";

type OrderType = "stop" | "limit" | "market";
export interface TicketOrder { symbol: string; qty: number; type: OrderType; price: number; stop: number; target: number; lev: number }

const TYPES: { id: OrderType; label: string; hint: string }[] = [
  { id: "stop", label: "Buy-stop", hint: "Buys only if the price rises to your trigger. The plan's way in." },
  { id: "limit", label: "Limit", hint: "Buys at your price or lower." },
  { id: "market", label: "Market", hint: "Buys now at the best available price." },
];

/**
 * A broker-style order ticket for one pick: choose the order type, the entry, the quantity (by hand, by risk or by margin),
 * how much leverage you want to use, and your own stop-loss and target. Shows the margin it needs, what you risk and what
 * the round trip costs before you send it.
 */
export function PickTicket({ pick, live, pot, maxLeverage, availableMoney, riskPct, regimeFactor, lock, onPlace, children }: {
  pick: IntradayPick; live?: { price: number; changePct: number }; pot: number; maxLeverage: number; availableMoney: number; riskPct: number; regimeFactor: number; lock: string | null;
  onPlace: (o: TicketOrder) => Promise<string | null>; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { plan } = pick;
  const [type, setType] = useState<OrderType>("stop");
  const [price, setPrice] = useState(plan.entry);
  const [stop, setStop] = useState(plan.stop);
  const [target, setTarget] = useState(plan.target1);
  const [lev, setLev] = useState(maxLeverage);
  const ltp = live?.price ?? pick.lastClose;
  const exec = type === "market" ? ltp : price;
  const maxQty = Math.max(0, Math.floor((availableMoney * lev) / Math.max(exec, 0.01)));
  const riskQty = (pct: number) => Math.max(0, Math.min(maxQty, Math.floor((pot * pct) / 100 / Math.max(exec - stop, 0.01))));
  const [qty, setQty] = useState(() => riskQty(riskPct * regimeFactor));

  const calc = useMemo(() => {
    const value = qty * exec;
    const margin = value / lev;
    const risk = qty * (exec - stop), reward = qty * (target - exec);
    const costs = intradayBreakEven(exec, qty, undefined, 2);
    return { value, margin, risk, reward, rr: risk > 0 ? reward / risk : NaN, costs };
  }, [qty, exec, stop, target, lev]);

  const problems: string[] = [];
  if (!(qty >= 1)) problems.push("Quantity must be at least 1.");
  if (!(stop < exec)) problems.push("The stop-loss must be below your entry price.");
  if (!(target > exec)) problems.push("The target must be above your entry price.");
  if (calc.margin > availableMoney + 0.5) problems.push(`Needs ${fmtInr(calc.margin)} of margin but only ${fmtInr(availableMoney)} is free.`);
  if (type === "stop" && price < ltp * 0.995) problems.push("A buy-stop trigger below the current price would fire at once. Use a limit order to buy on a dip.");
  const blocked = problems[0] ?? lock;

  const setQuick = (q: number) => setQty(Math.max(0, Math.min(maxQty, Math.floor(q))));
  const reset = () => { setType("stop"); setPrice(plan.entry); setStop(plan.stop); setTarget(plan.target1); setLev(maxLeverage); setQty(riskQty(riskPct * regimeFactor)); };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) reset(); }}>
      <Dialog.Trigger render={children as React.ReactElement} />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[min(30rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border bg-popover p-0 shadow-2xl outline-none transition-[opacity,transform] duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <div className="flex items-start gap-3 border-b px-5 py-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-heading text-xl font-semibold leading-tight">{displaySymbol(pick.symbol)}</Dialog.Title>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="figure text-lg">₹{ltp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                {live ? <Percent value={live.changePct} className={cn("text-sm", live.changePct >= 0 ? "text-up" : "text-down")} /> : <span className="text-xs text-muted-foreground">last close</span>}
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">Intraday MIS</span>
              </div>
            </div>
            <Dialog.Close aria-label="Close" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></Dialog.Close>
          </div>

          <div className="space-y-5 px-5 py-4">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Order type</div>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Order type">
                {TYPES.map((t) => (
                  <button key={t.id} type="button" role="radio" aria-checked={type === t.id} title={t.hint} onClick={() => { setType(t.id); if (t.id === "limit" && price > ltp) setPrice(plan.entry); }}
                    className={cn("rounded-[9px] py-1.5 text-sm font-medium transition-colors", type === t.id ? "bg-card shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>{t.label}</button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{TYPES.find((t) => t.id === type)!.hint}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="space-y-1"><span className="text-xs text-muted-foreground">{type === "stop" ? "Trigger price" : type === "limit" ? "Limit price" : "Price"}</span>
                {type === "market" ? <div className="flex h-8 items-center rounded-md border bg-muted/50 px-2.5 text-sm text-muted-foreground">Market</div> : <NumberField min={0.05} step={0.05} value={price} onChange={setPrice} />}</label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Stop-loss</span><NumberField min={0.05} step={0.05} value={stop} onChange={setStop} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Target</span><NumberField min={0.05} step={0.05} value={target} onChange={setTarget} /></label>
            </div>
            <div className="flex gap-1.5 text-xs">
              <button type="button" onClick={() => setTarget(plan.target1)} className={cn("rounded-full border px-2.5 py-1", target === plan.target1 ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>Target 1 · {plan.target1.toFixed(2)}</button>
              <button type="button" onClick={() => setTarget(plan.target2)} className={cn("rounded-full border px-2.5 py-1", target === plan.target2 ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>Target 2 · {plan.target2.toFixed(2)}</button>
              <button type="button" onClick={reset} className="ml-auto text-muted-foreground underline">Reset to plan</button>
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between"><span className="text-xs font-medium text-muted-foreground">Margin to use</span><span className="figure text-sm">{lev}×</span></div>
              <input type="range" min={1} max={maxLeverage} step={1} value={lev} onChange={(e) => { const l = Number(e.target.value); setLev(l); setQty((q) => Math.min(q, Math.floor((availableMoney * l) / Math.max(exec, 0.01)))); }} className="w-full accent-[var(--primary)]" aria-label="Leverage to use" />
              <div className="flex justify-between text-[11px] text-muted-foreground">{Array.from({ length: maxLeverage }, (_, i) => <span key={i}>{i + 1}×</span>)}</div>
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between"><span className="text-xs font-medium text-muted-foreground">Quantity</span><span className="text-xs text-muted-foreground">up to {maxQty.toLocaleString("en-IN")} at {lev}×</span></div>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Fewer" onClick={() => setQuick(qty - 1)} className="grid size-9 place-items-center rounded-lg border text-lg hover:bg-muted">−</button>
                <div className="flex-1"><NumberField min={0} step={1} value={qty} onChange={(v) => setQuick(Math.round(v))} /></div>
                <button type="button" aria-label="More" onClick={() => setQuick(qty + 1)} className="grid size-9 place-items-center rounded-lg border text-lg hover:bg-muted">+</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {([["Risk 0.5%", () => riskQty(0.5)], ["Risk 1%", () => riskQty(1)], ["Risk 2%", () => riskQty(2)], ["25% margin", () => maxQty * 0.25], ["50% margin", () => maxQty * 0.5], ["Max", () => maxQty]] as const).map(([l, f]) => (
                  <button key={l} type="button" onClick={() => setQuick(f())} className="rounded-full border px-2.5 py-1 text-muted-foreground hover:text-foreground">{l}</button>
                ))}
              </div>
            </div>

            <dl className="space-y-2 rounded-2xl bg-muted/50 p-4 text-sm">
              <Row label="Order value" value={fmtInr(calc.value)} />
              <Row label={`Margin required (${lev}×)`} value={fmtInr(calc.margin)} sub={`${fmtInr(availableMoney)} free`} bad={calc.margin > availableMoney + 0.5} />
              <Row label="If the stop-loss hits" value={`−${fmtInr(Math.max(0, calc.risk))}`} tone="down" sub={pot > 0 ? `${((Math.max(0, calc.risk) / pot) * 100).toFixed(2)}% of your pot` : undefined} />
              <Row label="If the target hits" value={`+${fmtInr(Math.max(0, calc.reward))}`} tone="up" sub={Number.isFinite(calc.rr) ? `${calc.rr.toFixed(1)}× the risk` : undefined} />
              <Row label="Charges and slippage" value={fmtInr(calc.costs.total)} sub={`price must move ${calc.costs.breakEvenPct.toFixed(2)}% to break even`} />
            </dl>

            {blocked && <p className="rounded-xl bg-down/10 px-3 py-2 text-sm text-down">{blocked}</p>}
          </div>

          <div className="sticky bottom-0 flex gap-2 border-t bg-popover px-5 py-3">
            <Dialog.Close render={<Button variant="outline" className="flex-1" />}>Cancel</Dialog.Close>
            <Button className="flex-[2]" disabled={!!blocked} onClick={async () => {
              const err = await onPlace({ symbol: pick.symbol, qty, type, price: exec, stop, target, lev });
              if (!err) setOpen(false);
            }}>Buy {qty > 0 ? `${qty} ` : ""}{displaySymbol(pick.symbol)}</Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Row({ label, value, sub, tone, bad }: { label: string; value: string; sub?: string; tone?: "up" | "down"; bad?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right"><div className={cn("figure", tone === "up" && "text-up", tone === "down" && "text-down", bad && "text-down")}>{value}</div>{sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}</dd>
    </div>
  );
}
