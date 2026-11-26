"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NumberField } from "@/components/backtest/number-field";
import { SimpleSelect } from "@/components/backtest/simple-select";
import { fmtInr, fmtPct } from "@/lib/format";
import { bankOf } from "@/lib/paper/funds";
import { usePaper } from "./paper-provider";
import { displaySymbol } from "@/lib/symbols";
import { useMarketOpen } from "@/components/use-market-open";

export function OrderTicket({ symbol, ltp, initialSide = "buy" }: { symbol: string; ltp?: number; initialSide?: "buy" | "sell" }) {
  const { state, place, ready, transfer } = usePaper();
  const open = useMarketOpen();
  const [side, setSide] = useState<"buy" | "sell">(initialSide);
  const [product, setProduct] = useState<"delivery" | "intraday">("delivery");
  const [type, setType] = useState<"market" | "limit" | "stop">("market");
  const [validity, setValidity] = useState<"day" | "gtt">("gtt");
  const [qty, setQty] = useState(10);
  const [limit, setLimit] = useState(0);
  const [useStop, setUseStop] = useState(true);
  const [stopPct, setStopPct] = useState(5);
  const [useTarget, setUseTarget] = useState(false);
  const [targetPct, setTargetPct] = useState(10);
  const [trailing, setTrailing] = useState(false);
  const [busy, setBusy] = useState(false);

  const held = state.positions.find((p) => p.symbol === symbol && p.direction === (side === "sell" ? "long" : "short"));
  const closing = !!held && product === held.product;
  const ref = type !== "market" && limit > 0 ? limit : ltp ?? 0;
  const dir = side === "buy" ? 1 : -1;
  const stop = useStop && !closing && ref ? ref * (1 - (dir * stopPct) / 100) : undefined;
  const target = useTarget && !closing && ref ? ref * (1 + (dir * targetPct) / 100) : undefined;

  const est = useMemo(() => {
    const value = qty * ref;
    const risk = stop !== undefined ? Math.abs(ref - stop) * qty : undefined;
    return { value, risk, riskPct: risk !== undefined ? (risk / state.cash) * 100 : undefined };
  }, [qty, ref, stop, state.cash]);

  // What this order will be called: exits of a position are take-profit / stop-loss.
  const kindName = type === "market" ? "Market" : closing ? (type === "limit" ? "Take-profit" : "Stop-loss") : type === "limit" ? "Limit" : "Stop";
  const nearestTick = (x: number) => Math.round(x * 20) / 20;

  /** Sensible starting price for a resting order, on the side where it would NOT trigger immediately. */
  function suggestPrice(t: "limit" | "stop"): number {
    if (!ltp) return 0;
    const exitLong = closing && held?.direction === "long";
    const exitShort = closing && held?.direction === "short";
    const above = t === "limit" ? (exitLong || (!closing && side === "sell")) : (exitShort || (!closing && side === "buy"));
    return nearestTick(ltp * (above ? (t === "limit" ? 1.05 : 1.03) : t === "limit" ? 0.97 : 0.97));
  }
  function changeType(t: "market" | "limit" | "stop") {
    setType(t);
    if (t !== "market") setLimit(suggestPrice(t));
  }
  const quickPcts = [3, 5, 10];
  const quickPrice = (pct: number) => {
    if (!ltp) return;
    const sign = type === "limit" ? (held?.direction === "short" ? -1 : 1) : (held?.direction === "short" ? 1 : -1);
    setLimit(nearestTick(ltp * (1 + (sign * pct) / 100)));
  };

  async function submit() {
    setBusy(true);
    const r = await place({
      symbol, side, qty, type, product,
      limitPrice: type === "limit" ? limit : undefined,
      triggerPrice: type === "stop" ? limit : undefined,
      validity: product === "intraday" ? "day" : validity,
      stop, target, trailing: trailing && stop !== undefined,
    });
    setBusy(false);
    if (r.error) toast.error(r.error);
    else toast.success(r.filled ? `${side === "buy" ? "Bought" : "Sold"} ${qty} ${displaySymbol(symbol)}` : `${kindName} order placed for ${displaySymbol(symbol)}. It executes when the price reaches ${limit.toFixed(2)}.`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Paper order
          <span className="font-mono text-sm font-normal text-muted-foreground">{ltp ? ltp.toFixed(2) : "—"}</span>
        </CardTitle>
        <CardDescription>
          {open === null ? "\u00a0" : open ? "Market open — fills at the live price" : "Market closed — fills at the last traded price"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button variant={side === "buy" ? "default" : "outline"} className={side === "buy" ? "bg-up text-background hover:bg-up/80" : ""} onClick={() => setSide("buy")}>Buy</Button>
          <Button variant={side === "sell" ? "default" : "outline"} className={side === "sell" ? "bg-down text-background hover:bg-down/80" : ""} onClick={() => setSide("sell")}>Sell</Button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Product</Label>
            <SimpleSelect className="w-full" value={product} onChange={setProduct}
              options={[{ value: "delivery", label: "Delivery (CNC)" }, { value: "intraday", label: "Intraday (MIS)" }]} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Order type</Label>
            <SimpleSelect className="w-full" value={type} onChange={changeType}
              options={[
                { value: "market", label: "Market" },
                { value: "limit", label: closing ? "Take-profit (limit)" : "Limit" },
                { value: "stop", label: closing ? "Stop-loss (trigger)" : "Stop (trigger)" },
              ]} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Quantity</Label>
            <NumberField min={1} value={qty} onChange={(v) => setQty(Math.max(1, Math.round(v)))} />
          </div>
          {type !== "market" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{type === "limit" ? "Limit price" : "Trigger price"}</Label>
              <NumberField min={0} step={0.05} value={limit} onChange={setLimit} />
            </div>
          )}
          {type !== "market" && product === "delivery" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Valid for</Label>
              <SimpleSelect className="w-full" value={validity} onChange={setValidity}
                options={[{ value: "gtt", label: "Until triggered (1 year)" }, { value: "day", label: "Today only" }]} />
            </div>
          )}
        </div>
        {type !== "market" && closing && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{type === "limit" ? "Take profit at" : "Stop loss at"}</span>
            {quickPcts.map((pc) => (
              <Button key={pc} size="xs" variant="outline" onClick={() => quickPrice(pc)}>{type === "limit" ? "+" : "−"}{pc}%</Button>
            ))}
          </div>
        )}
        {type !== "market" && (
          <p className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
            {type === "limit"
              ? `Waits until the price ${side === "buy" ? "falls to" : "rises to"} ${limit ? limit.toFixed(2) : "your limit"}, then fills at that price or better.`
              : `Waits until the price ${side === "buy" ? "rises to" : "falls to"} ${limit ? limit.toFixed(2) : "your trigger"}, then ${side === "buy" ? "buys" : "sells"} at market.`}
            {" "}It runs while this app is open; anything that triggered while you were away is applied when you next open it.
          </p>
        )}

        {!closing && (
          <div className="space-y-2.5 rounded-lg border p-3">
            <div className="flex items-center justify-between"><Label className="text-sm">Stop-loss</Label><Switch checked={useStop} onCheckedChange={setUseStop} /></div>
            {useStop && (
              <div className="grid grid-cols-2 items-end gap-2.5">
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Distance (%)</Label><NumberField min={0.1} step={0.5} value={stopPct} onChange={setStopPct} /></div>
                <div className="flex items-center justify-between pb-1.5"><Label className="text-xs text-muted-foreground">Trailing</Label><Switch checked={trailing} onCheckedChange={setTrailing} /></div>
              </div>
            )}
            <div className="flex items-center justify-between"><Label className="text-sm">Target</Label><Switch checked={useTarget} onCheckedChange={setUseTarget} /></div>
            {useTarget && (
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Distance (%)</Label><NumberField min={0.1} step={0.5} value={targetPct} onChange={setTargetPct} /></div>
            )}
          </div>
        )}

        <dl className="space-y-1 text-xs">
          <div className="flex justify-between"><dt className="text-muted-foreground">Order value</dt><dd className="font-mono">{fmtInr(est.value)}</dd></div>
          {stop !== undefined && <div className="flex justify-between"><dt className="text-muted-foreground">Stop at</dt><dd className="font-mono">{stop.toFixed(2)}</dd></div>}
          {target !== undefined && <div className="flex justify-between"><dt className="text-muted-foreground">Target at</dt><dd className="font-mono">{target.toFixed(2)}</dd></div>}
          {est.risk !== undefined && (
            <div className="flex justify-between"><dt className="text-muted-foreground">Risk if stopped</dt><dd className="font-mono">{fmtInr(est.risk)} ({fmtPct(est.riskPct ?? NaN, 2)} of cash)</dd></div>
          )}
          <div className="flex justify-between"><dt className="text-muted-foreground">Available cash</dt><dd className="font-mono">{fmtInr(state.cash)}</dd></div>
        </dl>
        {!closing && side === "buy" && est.value > state.cash && (
          <div className="space-y-1.5 rounded-lg border border-warn/40 bg-warn/10 p-2.5 text-xs text-warn">
            <p>Order value is {fmtInr(est.value - state.cash)} more than your available trading balance.</p>
            {bankOf(state) >= est.value - state.cash && (
              <Button size="xs" variant="outline" onClick={() => {
                const r = transfer("bank", Math.ceil((est.value - state.cash) * 1.01));
                if (r.error) toast.error(r.error); else toast.success("Moved money from your Bank balance");
              }}>Move {fmtInr(Math.ceil((est.value - state.cash) * 1.01))} from Bank</Button>
            )}
          </div>
        )}
        {closing && <p className="text-xs text-muted-foreground">This closes your existing {held!.qty}-share {held!.direction} position.</p>}
        <Button className="w-full" disabled={!ready || busy || !ltp} onClick={submit}>
          {busy ? "Placing…" : type !== "market" ? `Place ${kindName.toLowerCase()} order` : `${closing ? "Close" : side === "buy" ? "Buy" : "Sell"} ${qty} × ${displaySymbol(symbol)}`}
        </Button>
      </CardContent>
    </Card>
  );
}
