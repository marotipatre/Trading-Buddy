"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricCard } from "@/components/backtest/metric-card";
import { NumberField } from "@/components/backtest/number-field";
import { fmtInr, fmtNum, fmtPct } from "@/lib/format";
import { paperMetrics } from "@/lib/paper/analytics";
import { bankOf, capitalOf, tradingPnl } from "@/lib/paper/funds";
import { summarizePositions } from "@/lib/paper/portfolio";
import { ReviewPanel } from "./review-panel";
import { AlertsPanel } from "@/components/alerts/alerts-panel";
import { AccountEquityChart } from "./account-equity-chart";
import { FundsCard } from "./funds-card";
import { HoldingRows } from "./holding-rows";
import { InsightsPanel } from "./insights-panel";
import { JournalTable } from "./journal-table";
import { OrdersPanel } from "./orders-panel";
import { usePaper } from "./paper-provider";
import { useNow } from "@/components/use-now";

const TABS = ["holdings", "positions", "orders", "alerts", "funds", "analysis", "review"] as const;
type Tab = (typeof TABS)[number];

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`tabular truncate font-mono text-xl font-semibold tracking-tight sm:text-2xl ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : ""}`}>{value}</div>
      {sub && <div className={`tabular font-mono text-xs ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-muted-foreground"}`}>{sub}</div>}
    </div>
  );
}

export function PortfolioView() {
  const { state, equity, quotes, localOnly, error, ready, reset } = usePaper();
  const router = useRouter();
  const params = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "holdings";
  const [capital, setCapital] = useState(state.initialCapital);
  const [bankStart, setBankStart] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const m = useMemo(() => paperMetrics(state), [state]);

  const now = useNow();
  const sum = useMemo(
    () => summarizePositions(state, Object.fromEntries(Object.values(quotes).map((q) => [q.symbol, { price: q.price, prevClose: q.prevClose }])), now),
    [state, quotes, now],
  );
  const total = tradingPnl(state, equity);
  const [lo, hi] = m.winRateCI;

  if (!ready) {
    return <div className="space-y-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }
  const counts = { delivery: state.positions.filter((p) => p.product === "delivery").length, intraday: state.positions.filter((p) => p.product === "intraday").length };

  return (
    <div className="space-y-6">
      {(localOnly || error) && (
        <div className="flex gap-2 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            {localOnly && <p>Your paper account is stored only in this browser. Run <code>supabase/migrations/0002_paper_and_backtests.sql</code> in the Supabase SQL editor to sync it.</p>}
            {error && <p>{error}</p>}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
          <Stat label="Trading balance" value={fmtInr(equity)} sub={`Available ${fmtInr(state.cash)}`} />
          <Stat label="Total returns" value={fmtInr(total.pnl, { sign: true })} sub={fmtPct(total.pct, 2, { sign: true })} tone={total.pnl >= 0 ? "up" : "down"} />
          <Stat label="1D returns" value={fmtInr(sum.dayPnl, { sign: true })} sub={fmtPct(sum.dayPct, 2, { sign: true })} tone={sum.dayPnl >= 0 ? "up" : "down"} />
          <Stat label="Bank balance" value={fmtInr(bankOf(state))} sub={`Net worth ${fmtInr(equity + bankOf(state))}`} />
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => router.replace(`/portfolio?tab=${v}`, { scroll: false })} className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="holdings">Holdings{counts.delivery ? ` (${counts.delivery})` : ""}</TabsTrigger>
          <TabsTrigger value="positions">Positions{counts.intraday ? ` (${counts.intraday})` : ""}</TabsTrigger>
          <TabsTrigger value="orders">Orders{state.orders.length ? ` (${state.orders.length})` : ""}</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="funds">Funds</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="review">My portfolio review</TabsTrigger>
        </TabsList>

        <TabsContent value="holdings" className="space-y-3">
          {counts.delivery > 0 && (
            <div className="flex flex-wrap gap-x-8 gap-y-1 px-1 text-sm">
              <span className="text-muted-foreground">Invested <span className="tabular font-mono text-foreground">{fmtInr(summarizePositions(state, {}, now, "delivery").invested)}</span></span>
            </div>
          )}
          <HoldingRows product="delivery" empty="You have no holdings yet. Buy a stock with Delivery (CNC) to hold it for days or weeks." />
        </TabsContent>
        <TabsContent value="positions"><HoldingRows product="intraday" empty="No open intraday positions. Intraday (MIS) trades close automatically at 3:15 pm." /></TabsContent>
        <TabsContent value="orders"><OrdersPanel /></TabsContent>
        <TabsContent value="alerts"><AlertsPanel /></TabsContent>
        <TabsContent value="funds" className="space-y-4">
          <FundsCard />
          <Card>
            <CardHeader>
              <CardTitle>Reset account</CardTitle>
              <CardDescription>Clears every position, order, journal entry and money history, then starts again with the balances below.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="w-44 space-y-1"><div className="text-xs text-muted-foreground">Trading balance (₹)</div><NumberField min={0} step={100000} value={capital} onChange={setCapital} /></div>
              <div className="w-44 space-y-1"><div className="text-xs text-muted-foreground">Bank balance (₹)</div><NumberField min={0} step={100000} value={bankStart} onChange={setBankStart} /></div>
              {confirm ? (
                <>
                  <Button variant="destructive" onClick={() => { reset(capital, bankStart); setConfirm(false); toast.success("Account reset"); }}>Yes, erase and reset</Button>
                  <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setConfirm(true)}>Reset…</Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="review"><ReviewPanel /></TabsContent>
        <TabsContent value="analysis" className="space-y-6">
          {m.trades > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="Win rate" value={fmtPct(m.winRate * 100, 0)} sub={`95% range ${fmtPct(lo * 100, 0)} – ${fmtPct(hi * 100, 0)} · ${m.trades} trades`} />
              <MetricCard label="Expectancy / trade" value={fmtPct(m.expectancyPct, 2, { sign: true })} tone={m.expectancyPct > 0 ? "up" : "down"} />
              <MetricCard label="Profit factor" value={fmtNum(m.profitFactor)} tone={m.profitFactor > 1 ? "up" : "down"} />
              <MetricCard label="Charges paid" value={fmtInr(m.totalCharges)} />
            </div>
          )}
          {(state.equityHistory?.length ?? 0) >= 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Profit and loss over time</CardTitle>
                <CardDescription>Measured against the money you put into trading, so adding funds never looks like profit.</CardDescription>
              </CardHeader>
              <CardContent><AccountEquityChart history={state.equityHistory!} initial={capitalOf(state)} /></CardContent>
            </Card>
          )}
          <InsightsPanel />
          <JournalTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
