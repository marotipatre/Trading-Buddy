"use client";

import { useState } from "react";
import { Bell, BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NumberField } from "@/components/backtest/number-field";
import { SimpleSelect } from "@/components/backtest/simple-select";
import { describeAlert, distanceToAlert, type AlertDirection } from "@/lib/alerts";
import { displaySymbol } from "@/lib/symbols";
import { useAlerts } from "./alerts-provider";

const tick = (x: number) => Math.round(x * 20) / 20;

/** Set a price alert for the stock you are looking at. */
export function AlertForm({ symbol, ltp }: { symbol: string; ltp?: number }) {
  const { alerts, create, cancel, notifications, enableNotifications } = useAlerts();
  const [dir, setDir] = useState<AlertDirection>("above");
  const [price, setPrice] = useState(0);
  const mine = alerts.filter((a) => a.symbol === symbol && a.status === "active");
  const suggested = (d: AlertDirection) => (ltp ? tick(ltp * (d === "above" ? 1.03 : 0.97)) : 0);

  async function add() {
    const r = await create(symbol, dir, price || suggested(dir), ltp);
    if (r.error) toast.error(r.error);
    else toast.success(`Alert set: ${displaySymbol(symbol)} ${dir === "above" ? "rises to" : "falls to"} ${(price || suggested(dir)).toFixed(2)}`);
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-medium"><Bell className="size-4 text-primary" /> Price alert</div>
          {notifications === "default" && <Button size="xs" variant="outline" onClick={enableNotifications}>Enable notifications</Button>}
          {notifications === "granted" && <span className="flex items-center gap-1 text-xs text-muted-foreground"><BellRing className="size-3.5" /> Notifications on</span>}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <SimpleSelect className="w-full" value={dir} onChange={(d) => { setDir(d); setPrice(suggested(d)); }}
            options={[{ value: "above", label: "Rises to" }, { value: "below", label: "Falls to" }]} />
          <NumberField min={0} step={0.05} value={price || suggested(dir)} onChange={setPrice} />
        </div>
        <Button size="sm" className="w-full" disabled={!ltp} onClick={add}>Set alert</Button>
        {mine.length > 0 && (
          <ul className="space-y-1.5">
            {mine.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
                <span>{describeAlert(a)}{ltp ? <span className="ml-1 text-muted-foreground">({distanceToAlert(a, ltp).toFixed(1)}% away)</span> : null}</span>
                <Button size="icon-xs" variant="ghost" aria-label="Cancel alert" onClick={() => cancel(a.id)}><X /></Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Checked while this app is open. A browser notification appears if you allow them.</p>
      </CardContent>
    </Card>
  );
}
