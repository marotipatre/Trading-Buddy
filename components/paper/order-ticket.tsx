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

export function OrderTicket({ symbol, ltp }: { symbol: string; ltp?: number }) {
  const { state, place, ready, transfer } = usePaper();
  const open = useMarketOpen();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [product, setProduct] = useState<"delivery" | "intraday">("delivery");
  const [type, setType] = useState<"market" | "limit">("market");
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
  const ref = type === "limit" && limit > 0 ? limit : ltp ?? 0;
  const dir = side === "buy" ? 1 : -1;
  const stop = useStop && !closing && ref ? ref * (1 - (dir * stopPct) / 100) : undefined;
  const target = useTarget && !closing && ref ? ref * (1 + (dir * targetPct) / 100) : undefined;

  const est = useMemo(() => {
    const value = qty * ref;
    const risk = stop !== undefined ? Math.abs(ref - stop) * qty : undefined;
    return { value, risk, riskPct: risk !== undefined ? (risk / state.cash) * 100 : undefined };
  }, [qty, ref, stop, state.cash]);

  async function submit() {
    setBusy(true);
    const r = await place({
      symbol, side, qty, type, product, limitPrice: type === "limit" ? limit : undefined,
      stop, target, trailing: trailing && stop !== undefined,
    });
    setBusy(false);
    if (r.error) toast.error(r.error);
    else toast.success(r.filled ? `${side === "buy" ? "Bought" : "Sold"} ${qty} ${displaySymbol(symbol)}` : `Limit order placed for ${displaySymbol(symbol)}`);
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
            <SimpleSelect className="w-full" value={type} onChange={setType}
              options={[{ value: "market", label: "Market" }, { value: "limit", label: "Limit" }]} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Quantity</Label>
            <NumberField min={1} value={qty} onChange={(v) => setQty(Math.max(1, Math.round(v)))} />
          </div>
          {type === "limit" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Limit price</Label>
              <NumberField min={0} step={0.05} value={limit} onChange={setLimit} />
            </div>
          )}
        </div>

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
          {busy ? "Placing…" : `${closing ? "Close" : side === "buy" ? "Buy" : "Sell"} ${qty} × ${displaySymbol(symbol)}`}
        </Button>
      </CardContent>
    </Card>
  );
}
