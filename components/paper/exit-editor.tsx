"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NumberField } from "@/components/backtest/number-field";
import { fmtInr } from "@/lib/format";
import type { PaperPosition } from "@/lib/paper/types";
import { usePaper } from "./paper-provider";

const tick = (x: number) => Math.round(x * 20) / 20;

/** Set, change or remove a position's stop-loss and take-profit. They are linked: when one executes the other disappears. */
export function ExitEditor({ position: p, ltp, onDone }: { position: PaperPosition; ltp: number; onDone: () => void }) {
  const { setExits } = usePaper();
  const s = p.direction === "long" ? 1 : -1;
  const [stop, setStop] = useState(p.stop ?? 0);
  const [target, setTarget] = useState(p.target ?? 0);
  const [useStop, setUseStop] = useState(p.stop !== undefined);
  const [useTarget, setUseTarget] = useState(p.target !== undefined);
  const [trailing, setTrailing] = useState(p.trailDist !== undefined);
  const [busy, setBusy] = useState(false);

  const pctFrom = (price: number) => (ltp ? ((price - ltp) / ltp) * 100 : 0);
  const atRisk = useStop && stop > 0 ? Math.max(0, s * (p.entryPrice - stop)) * p.qty : 0;
  const lockedOrLoss = useStop && stop > 0 ? s * (stop - p.entryPrice) * p.qty : 0;
  const upside = useTarget && target > 0 ? s * (target - p.entryPrice) * p.qty : 0;

  async function apply() {
    setBusy(true);
    const r = await setExits(p.id, { stop: useStop && stop > 0 ? stop : null, target: useTarget && target > 0 ? target : null, trailing: useStop && trailing });
    setBusy(false);
    if (r.error) toast.error(r.error);
    else { toast.success("Exit orders saved"); onDone(); }
  }

  return (
    <div className="space-y-3 border-t bg-muted/30 px-4 py-4">
      <div className="text-xs text-muted-foreground">Current price {ltp.toFixed(2)} · your average {p.entryPrice.toFixed(2)}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between"><Label className="text-sm">Stop-loss</Label><Switch checked={useStop} onCheckedChange={setUseStop} /></div>
          {useStop && (
            <>
              <NumberField min={0} step={0.05} value={stop} onChange={setStop} />
              <div className="flex flex-wrap items-center gap-1.5">
                {[3, 5, 8].map((pc) => <Button key={pc} size="xs" variant="outline" onClick={() => setStop(tick(ltp * (1 - (s * pc) / 100)))}>−{pc}%</Button>)}
                <span className="text-xs text-muted-foreground">{stop > 0 ? `${pctFrom(stop).toFixed(1)}% from price` : ""}</span>
              </div>
              <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Trailing (follows the price)</Label><Switch checked={trailing} onCheckedChange={setTrailing} /></div>
              {stop > 0 && <div className="text-xs text-muted-foreground">{lockedOrLoss >= 0 ? <>Locks in <span className="font-mono text-up">{fmtInr(lockedOrLoss)}</span></> : <>Risk <span className="font-mono text-down">{fmtInr(atRisk)}</span></>} if hit</div>}
            </>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><Label className="text-sm">Take-profit</Label><Switch checked={useTarget} onCheckedChange={setUseTarget} /></div>
          {useTarget && (
            <>
              <NumberField min={0} step={0.05} value={target} onChange={setTarget} />
              <div className="flex flex-wrap items-center gap-1.5">
                {[5, 10, 15].map((pc) => <Button key={pc} size="xs" variant="outline" onClick={() => setTarget(tick(ltp * (1 + (s * pc) / 100)))}>+{pc}%</Button>)}
                <span className="text-xs text-muted-foreground">{target > 0 ? `${pctFrom(target).toFixed(1)}% from price` : ""}</span>
              </div>
              {target > 0 && <div className="text-xs text-muted-foreground">Gain <span className="font-mono text-up">{fmtInr(upside)}</span> if hit</div>}
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={busy} onClick={apply}>Save exit orders</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
        <span className="ml-auto text-xs text-muted-foreground">When one executes, the other is cancelled.</span>
      </div>
    </div>
  );
}
