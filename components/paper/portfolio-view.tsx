"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "motion/react";
import { Money, Percent, PillTabs, SPRING, Swap } from "@/components/motion/primitives";
import { cn } from "@/lib/utils";
import { MetricCard } from "@/components/backtest/metric-card";
import { NumberField } from "@/components/backtest/number-field";
import { fmtInr, fmtNum, fmtPct } from "@/lib/format";
import { paperMetrics } from "@/lib/paper/analytics";
import { bankOf, capitalOf, tradingPnl } from "@/lib/paper/funds";
import { summarizePositions } from "@/lib/paper/portfolio";
import { ReviewPanel } from "./review-panel";
import { GraduationCard } from "@/components/graduation-card";
import { WeeklyReviewCard } from "@/components/weekly-review-card";
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

export function PortfolioView() {
  const { state, equity, quotes, localOnly, error, ready, reset, available, blocked } = usePaper();
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
  const invested = summarizePositions(state, {}, now).invested;
  const alloc = equity > 0 ? Math.min(100, Math.max(0, (invested / equity) * 100)) : 0;

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

      <section className="grid gap-6 rounded-3xl border bg-card p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr]" aria-label="Portfolio summary">
        <div>
          <div className="text-sm text-muted-foreground">Trading balance</div>
          <Money value={equity} className="figure block text-5xl leading-none sm:text-6xl" />
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <span className={cn("figure", sum.dayPnl >= 0 ? "text-up" : "text-down")}><Money value={sum.dayPnl} sign /> <span className="text-muted-foreground">today</span> <Percent value={sum.dayPct} className="text-sm" /></span>
            <span className={cn("figure", total.pnl >= 0 ? "text-up" : "text-down")}><Money value={total.pnl} sign /> <span className="text-muted-foreground">overall</span> <Percent value={total.pct} className="text-sm" /></span>
          </div>
        </div>
        <div className="space-y-4 self-end">
          <div>
            <div className="mb-1.5 flex justify-between text-sm"><span className="text-muted-foreground">Where your money is</span><span className="figure"><Percent value={alloc} decimals={0} sign={false} /> invested</span></div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
              <motion.div className="h-full bg-primary" initial={false} animate={{ width: `${alloc}%` }} transition={SPRING} />
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground"><span>Invested <Money value={invested} /></span><span>{blocked > 0 ? <>Held by orders <Money value={blocked} /> · </> : null}Available <Money value={available} /></span></div>
          </div>
          <div className="flex justify-between border-t pt-3 text-sm"><span className="text-muted-foreground">Bank balance</span><span className="figure"><Money value={bankOf(state)} /></span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Net worth</span><span className="figure"><Money value={equity + bankOf(state)} /></span></div>
        </div>
      </section>

      <div className="space-y-4">
        <PillTabs value={tab} onChange={(v) => router.replace(`/portfolio?tab=${v}`, { scroll: false })} ariaLabel="Portfolio sections" options={[
          { value: "holdings", label: "Holdings", badge: counts.delivery || undefined },
          { value: "positions", label: "Day positions", badge: counts.intraday || undefined },
          { value: "orders", label: "Orders", badge: state.orders.length || undefined },
          { value: "alerts", label: "Alerts" }, { value: "funds", label: "Funds" }, { value: "analysis", label: "Analysis" }, { value: "review", label: "Review" },
        ]} />
        <Swap id={tab} className="space-y-4">

        {tab === "holdings" && <div className="space-y-3">
          {counts.delivery > 0 && (
            <div className="flex flex-wrap gap-x-8 gap-y-1 px-1 text-sm">
              <span className="text-muted-foreground">Invested <span className="tabular font-mono text-foreground">{fmtInr(summarizePositions(state, {}, now, "delivery").invested)}</span></span>
            </div>
          )}
          <HoldingRows product="delivery" empty="You have no holdings yet. Buy a stock with Delivery (CNC) to hold it for days or weeks." />
        </div>}
        {tab === "positions" && <div className="space-y-3"><p className="text-sm text-muted-foreground">Day trades placed from the Trade page in this account. The separate 5x pot has its own page: <Link className="text-primary underline" href="/intraday">Intraday desk</Link>.</p><HoldingRows product="intraday" empty="No open day positions. Intraday (MIS) trades close automatically at 3:15 pm." /></div>}
        {tab === "orders" && <div><OrdersPanel /></div>}
        {tab === "alerts" && <div><AlertsPanel /></div>}
        {tab === "funds" && <div className="space-y-4">
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
        </div>}
        {tab === "review" && <div><ReviewPanel /></div>}
        {tab === "analysis" && <div className="space-y-6">
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
          <WeeklyReviewCard trades={state.trades} title="Paper trading" />
          <GraduationCard trades={state.trades} />
          <InsightsPanel />
          <JournalTable />
        </div>}
        </Swap>
      </div>
    </div>
  );
}
