"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/backtest/number-field";
import { expectancy, intradayBreakEven, positionSize, recoveryNeeded, streakProbability } from "@/lib/playbook/calc";
import { fmtInr } from "@/lib/format";

const Row = ({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) => (
  <div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">{label}</span><b className={`font-mono ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : ""}`}>{value}</b></div>
);
const F = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;

export function Calculators({ intraday }: { intraday: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SizeCalc intraday={intraday} />
      <ExpectancyCalc />
      <StreakCalc />
      {intraday ? <CostCalc /> : <RecoveryCalc />}
    </div>
  );
}

function SizeCalc({ intraday }: { intraday: boolean }) {
  const [cap, setCap] = useState(intraday ? 100000 : 300000);
  const [risk, setRisk] = useState(1);
  const [entry, setEntry] = useState(500);
  const [stop, setStop] = useState(490);
  const [lev, setLev] = useState(intraday ? 5 : 1);
  const s = positionSize(cap, risk, entry, stop, lev);
  return (
    <Card>
      <CardHeader><CardTitle>Position size</CardTitle><CardDescription>Shares so that being stopped out costs a fixed share of your money.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <F label={intraday ? "Your money in the pot (₹)" : "Capital (₹)"}><NumberField min={1000} step={10000} value={cap} onChange={setCap} /></F>
          <F label="Risk per trade (%)"><NumberField min={0.1} max={5} step={0.25} value={risk} onChange={setRisk} /></F>
          <F label="Entry price"><NumberField min={0} step={0.05} value={entry} onChange={setEntry} /></F>
          <F label="Stop price"><NumberField min={0} step={0.05} value={stop} onChange={setStop} /></F>
          {intraday && <F label="Leverage (x)"><NumberField min={1} max={20} value={lev} onChange={setLev} /></F>}
        </div>
        <div className="space-y-1 rounded-lg bg-muted/50 p-3">
          <Row label="Shares to buy" value={String(s.qty)} />
          <Row label="Rupees at risk" value={fmtInr(s.riskAmt)} tone="down" />
          <Row label="Position value" value={fmtInr(s.notional)} />
          {intraday && <Row label="Your money used as margin" value={fmtInr(s.margin)} />}
          <Row label="Stop distance" value={`${s.perSharePct.toFixed(2)}%`} />
        </div>
        {s.qty > 0 && s.notional > cap * lev && <p className="text-xs text-down">This position is larger than your buying power. Reduce size.</p>}
      </CardContent>
    </Card>
  );
}

function ExpectancyCalc() {
  const [win, setWin] = useState(40);
  const [aw, setAw] = useState(2);
  const [al, setAl] = useState(1);
  const e = expectancy(win / 100, aw, al);
  return (
    <Card>
      <CardHeader><CardTitle>Expectancy</CardTitle><CardDescription>What your average trade earns, in R, before costs.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2.5">
          <F label="Win rate (%)"><NumberField min={1} max={99} value={win} onChange={setWin} /></F>
          <F label="Average win (R)"><NumberField min={0.1} step={0.1} value={aw} onChange={setAw} /></F>
          <F label="Average loss (R)"><NumberField min={0.1} step={0.1} value={al} onChange={setAl} /></F>
        </div>
        <div className="space-y-1 rounded-lg bg-muted/50 p-3">
          <Row label="Expectancy per trade" value={`${e.perTrade >= 0 ? "+" : ""}${e.perTrade.toFixed(2)}R`} tone={e.perTrade >= 0 ? "up" : "down"} />
          <Row label="Break-even win rate" value={`${(e.breakEvenWinRate * 100).toFixed(0)}%`} />
          <Row label="Profit factor" value={Number.isFinite(e.profitFactor) ? e.profitFactor.toFixed(2) : "no losses"} />
        </div>
      </CardContent>
    </Card>
  );
}

function StreakCalc() {
  const [win, setWin] = useState(45);
  const [n, setN] = useState(100);
  const [k, setK] = useState(6);
  const p = streakProbability(1 - win / 100, n, k);
  return (
    <Card>
      <CardHeader><CardTitle>Losing streaks to expect</CardTitle><CardDescription>Chance of a run of losses somewhere in a series of trades, if each trade is independent.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2.5">
          <F label="Win rate (%)"><NumberField min={1} max={99} value={win} onChange={setWin} /></F>
          <F label="Trades"><NumberField min={5} max={2000} value={n} onChange={(v) => setN(Math.round(v))} /></F>
          <F label="Losses in a row"><NumberField min={2} max={30} value={k} onChange={(v) => setK(Math.round(v))} /></F>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <b className="font-mono text-lg">{(p * 100).toFixed(p < 0.01 ? 2 : 0)}%</b> chance of at least one run of {k} losses in {n} trades. Plan for it: size so that this streak does not threaten your account or your discipline.
        </div>
      </CardContent>
    </Card>
  );
}

function RecoveryCalc() {
  const [loss, setLoss] = useState(20);
  return (
    <Card>
      <CardHeader><CardTitle>Recovery after a loss</CardTitle><CardDescription>Why protecting capital comes first.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <F label="Loss (%)"><NumberField min={1} max={99} value={loss} onChange={setLoss} /></F>
        <div className="rounded-lg bg-muted/50 p-3 text-sm">After losing <b>{loss}%</b> you need a gain of <b className="font-mono text-lg">{recoveryNeeded(loss).toFixed(1)}%</b> just to get back to where you started.</div>
      </CardContent>
    </Card>
  );
}

function CostCalc() {
  const [price, setPrice] = useState(500);
  const [qty, setQty] = useState(200);
  const [slip, setSlip] = useState(2);
  const c = intradayBreakEven(price, qty, undefined, slip);
  return (
    <Card>
      <CardHeader><CardTitle>Break-even after costs</CardTitle><CardDescription>Charges and slippage on one intraday round trip, using this app&apos;s typical Indian charge model (your broker&apos;s may differ).</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2.5">
          <F label="Price"><NumberField min={0} step={0.05} value={price} onChange={setPrice} /></F>
          <F label="Shares"><NumberField min={1} value={qty} onChange={(v) => setQty(Math.round(v))} /></F>
          <F label="Slippage (bps/side)"><NumberField min={0} step={1} value={slip} onChange={setSlip} /></F>
        </div>
        <div className="space-y-1 rounded-lg bg-muted/50 p-3">
          <Row label="Charges (brokerage, taxes, fees)" value={fmtInr(c.charges)} />
          <Row label="Slippage" value={fmtInr(c.slippage)} />
          <Row label="Total cost" value={fmtInr(c.total)} tone="down" />
          <Row label="Price must move just to break even" value={`${c.breakEvenPct.toFixed(3)}% (₹${c.perShare.toFixed(2)} a share)`} />
        </div>
        <p className="text-xs text-muted-foreground">If your target is only a few times this number, costs will take most of your profit.</p>
      </CardContent>
    </Card>
  );
}
