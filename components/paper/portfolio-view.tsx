"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/backtest/metric-card";
import { NumberField } from "@/components/backtest/number-field";
import { fmtInr, fmtNum, fmtPct } from "@/lib/format";
import { paperMetrics } from "@/lib/paper/analytics";
import { AccountEquityChart } from "./account-equity-chart";
import { InsightsPanel } from "./insights-panel";
import { JournalTable } from "./journal-table";
import { usePaper } from "./paper-provider";
import { PositionsPanel } from "./positions-panel";
import { bankOf, capitalOf, tradingPnl } from "@/lib/paper/funds";
import { FundsCard } from "./funds-card";

export function PortfolioView() {
  const { state, equity, quotes, localOnly, error, ready, reset } = usePaper();
  const [capital, setCapital] = useState(state.initialCapital);
  const [bankStart, setBankStart] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const m = useMemo(() => paperMetrics(state), [state]);

  const realised = state.trades.reduce((a, t) => a + t.netPnl, 0);
  const open = state.positions.reduce((a, p) => {
    const ltp = quotes[p.symbol]?.price ?? p.entryPrice;
    return a + (p.direction === "long" ? 1 : -1) * (ltp - p.entryPrice) * p.qty;
  }, 0);
  const [lo, hi] = m.winRateCI;

  if (!ready) return <p className="text-sm text-muted-foreground">Loading your paper account…</p>;
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Trading balance" value={fmtInr(equity)} sub={`Capital put in ${fmtInr(capitalOf(state))}`} />
        <MetricCard label="Total return" value={fmtPct(tradingPnl(state, equity).pct, 2, { sign: true })}
          tone={equity >= capitalOf(state) ? "up" : "down"} sub={`Open ${fmtInr(open, { sign: true })} · Realised ${fmtInr(realised, { sign: true })}`} />
        <MetricCard label="Available to trade" value={fmtInr(state.cash)} sub={`Bank balance ${fmtInr(bankOf(state))}`} />
        <MetricCard label="Win rate (paper)" value={m.trades ? fmtPct(m.winRate * 100, 0) : "—"}
          sub={m.trades ? `95% range ${fmtPct(lo * 100, 0)} – ${fmtPct(hi * 100, 0)} · ${m.trades} trades` : "No closed trades yet"} />
      </div>
      {m.trades > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Expectancy / trade" value={fmtPct(m.expectancyPct, 2, { sign: true })} tone={m.expectancyPct > 0 ? "up" : "down"} />
          <MetricCard label="Profit factor" value={fmtNum(m.profitFactor)} tone={m.profitFactor > 1 ? "up" : "down"} />
          <MetricCard label="Avg win / avg loss" value={`${fmtPct(m.avgWinPct, 1)} / ${fmtPct(m.avgLossPct, 1)}`} />
          <MetricCard label="Charges paid" value={fmtInr(m.totalCharges)} />
        </div>
      )}
      {(state.equityHistory?.length ?? 0) >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Account value</CardTitle>
            <CardDescription>Profit or loss on the money you put into trading, so adding funds never looks like profit.</CardDescription>
          </CardHeader>
          <CardContent><AccountEquityChart history={state.equityHistory!} initial={capitalOf(state)} /></CardContent>
        </Card>
      )}
      <FundsCard />
      <PositionsPanel />
      <InsightsPanel />
      <JournalTable />
      <Card>
        <CardHeader>
          <CardTitle>Reset account</CardTitle>
          <CardDescription>Clears every position, order and journal entry and starts again with fresh virtual cash.</CardDescription>
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
    </div>
  );
}
