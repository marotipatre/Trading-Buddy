"use client";

import { Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { SymbolLabel } from "@/components/symbol-label";
import { useQuotes } from "@/components/use-quotes";
import { activeSymbols, describeAlert, distanceToAlert } from "@/lib/alerts";
import { fmtDate } from "@/lib/format";
import { useAlerts } from "./alerts-provider";

export function AlertsPanel() {
  const { alerts, ready, localOnly, cancel, remove, notifications, enableNotifications } = useAlerts();
  const active = alerts.filter((a) => a.status === "active");
  const done = alerts.filter((a) => a.status !== "active");
  const { quotes } = useQuotes(activeSymbols(alerts), { enabled: ready });
  if (!ready) return null;
  return (
    <div className="space-y-4">
      {localOnly && <p className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">Alerts are stored only in this browser. Run <code>supabase/migrations/0003_price_alerts.sql</code> in the Supabase SQL editor to keep them in your account.</p>}
      {notifications === "default" && (
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <span>Get a browser notification when an alert fires.</span>
          <Button size="sm" variant="outline" onClick={enableNotifications}>Enable notifications</Button>
        </div>
      )}
      <Card className="py-0">
        <CardHeader className="pt-4"><CardTitle>Active alerts ({active.length})</CardTitle></CardHeader>
        {active.length === 0 ? (
          <p className="px-4 pb-5 text-sm text-muted-foreground">No active alerts. Open any stock on the Trade page and set one. Alerts are checked while this app is open.</p>
        ) : active.map((a) => {
          const q = quotes[a.symbol];
          return (
            <div key={a.id} className="flex items-center gap-3 border-t px-4 py-3">
              <SymbolLabel symbol={a.symbol} className="flex-1" />
              <div className="text-right text-sm">
                <div className="tabular font-mono">{describeAlert(a)}</div>
                {q && <div className="text-xs text-muted-foreground">now {q.price.toFixed(2)} · {distanceToAlert(a, q.price).toFixed(1)}% to go</div>}
              </div>
              <Button size="icon-sm" variant="ghost" aria-label="Cancel alert" onClick={() => cancel(a.id)}><X /></Button>
            </div>
          );
        })}
      </Card>
      {done.length > 0 && (
        <Card className="py-0">
          <CardHeader className="pt-4"><CardTitle>History</CardTitle></CardHeader>
          {done.slice(0, 30).map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-t px-4 py-2.5 text-sm">
              <SymbolLabel symbol={a.symbol} compact className="flex-1" />
              <span className="tabular font-mono text-muted-foreground">{describeAlert(a)}</span>
              <Badge variant={a.status === "triggered" ? "default" : "outline"}>{a.status === "triggered" ? `Hit ${a.triggeredPrice?.toFixed(2) ?? ""} · ${a.triggeredAt ? fmtDate(a.triggeredAt) : ""}` : "Cancelled"}</Badge>
              <Button size="icon-sm" variant="ghost" aria-label="Delete alert" onClick={() => remove(a.id)}><Trash2 /></Button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
