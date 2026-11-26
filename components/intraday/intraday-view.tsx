"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/backtest/number-field";
import { useUniverse } from "@/components/use-universe";
import { fetchCandles, pool as runPool } from "@/lib/analysis/candle-cache";
import { newsMood } from "@/lib/analysis/sentiment";
import { pnlByDay } from "@/lib/intraday/account";
import { loadBatches, saveBatch, type PickBatch } from "@/lib/intraday/log";
import { intradaySize, scoreIntraday, topPicks, type IntradayPick } from "@/lib/intraday/picks";
import { evaluatePick, summarize, type PickResult } from "@/lib/intraday/scorecard";
import { fmtInr, fmtPct } from "@/lib/format";
import { displaySymbol } from "@/lib/symbols";
import { cn } from "@/lib/utils";
import { IntradayProvider, useIntraday } from "./intraday-provider";

const istToday = () => new Date(Date.now() + 19800_000).toISOString().slice(0, 10);
const OUTCOME = { target: "Target hit", stop: "Stopped out", eod: "Closed at 3:15", "no-entry": "Never triggered", "skipped-gap": "Skipped (gap)" } as const;

export function IntradayView() {
  return <IntradayProvider><Inner /></IntradayProvider>;
}

function Inner() {
  const { acc, ready, view, create, topUp, reset } = useIntraday();
  const [potInput, setPotInput] = useState(100000);
  const [add, setAdd] = useState(25000);
  if (!ready) return null;
  if (!acc || !view) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set up your intraday pot</CardTitle>
          <CardDescription>A separate paper account for day trading. Put in the money you would risk, and you can trade five times that with margin. Its profit and loss are tracked on their own, never mixed with your main paper account. Everything closes by 3:15 pm.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-48 space-y-1"><Label className="text-xs text-muted-foreground">Your money in the pot (₹)</Label><NumberField min={1000} step={10000} value={potInput} onChange={setPotInput} /></div>
          <p className="text-sm text-muted-foreground">Buying power: <b className="text-foreground">{fmtInr(potInput * 5)}</b></p>
          <Button onClick={() => create(potInput)} disabled={potInput < 1000}>Create pot</Button>
        </CardContent>
      </Card>
    );
  }
  const days = pnlByDay(acc.state);
  const today = days.find((d) => d.date === istToday());
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-5">
          <Stat label="Pot value" value={fmtInr(view.value)} sub={`Started with ${fmtInr(acc.pot)}`} />
          <Stat label="Total P&L" value={fmtInr(view.pnl, { sign: true })} sub={fmtPct(view.pnlPct, 1, { sign: true }) + " of pot"} tone={view.pnl >= 0 ? "up" : "down"} />
          <Stat label="Today" value={fmtInr(today?.pnl ?? 0, { sign: true })} sub={`${today?.trades ?? 0} trades closed`} tone={(today?.pnl ?? 0) >= 0 ? "up" : "down"} />
          <Stat label="Buying power" value={fmtInr(view.buyingPower)} sub={`${acc.leverage}x margin`} />
          <Stat label="Margin in use" value={fmtInr(view.marginUsed)} sub="of your own money" />
        </CardContent>
        <CardContent className="flex flex-wrap items-center gap-2 pt-0">
          <div className="w-36"><NumberField min={1000} step={5000} value={add} onChange={setAdd} /></div>
          <Button variant="outline" size="sm" onClick={() => { const r = topUp(add); if (r.error) toast.error(r.error); else toast.success(`Added ${fmtInr(add)} to the pot`); }}>Add to pot</Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { if (confirm("Erase the intraday account, its trades and P&L, and start again?")) reset(); }}>Reset…</Button>
          {view.broke && <span className="text-sm text-down">Your pot is used up.</span>}
        </CardContent>
      </Card>
      <Picks />
      <Open />
      <Results />
      <Scorecard />
      <p className="text-xs text-muted-foreground">Day trading on margin loses money for most people (SEBI&apos;s own studies of Indian traders say so). Read the <Link className="underline" href="/playbook?book=intraday">intraday rule book</Link> before you trade. Paper money only, for learning; picks are rule-based screens, not advice.</p>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("tabular truncate font-mono text-xl font-semibold", tone === "up" && "text-up", tone === "down" && "text-down")}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Picks() {
  const { acc, place } = useIntraday();
  const { stocks } = useUniverse();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [batch, setBatch] = useState<PickBatch | null>(() => (typeof window === "undefined" ? null : loadBatches().at(-1) ?? null));
  const [riskPct, setRiskPct] = useState(1);
  const stopRef = useRef(false);

  const generate = useCallback(async () => {
    const universe = (stocks ?? []).filter((s) => s.cap === "large" || s.cap === "mid");
    if (!universe.length) { toast.error("Stock list is still loading"); return; }
    stopRef.current = false;
    setRunning(true);
    const found: IntradayPick[] = [];
    let done = 0;
    try {
      await runPool(universe, 8, async (s) => {
        try { const p = scoreIntraday(s.symbol, s.name, s.sector, await fetchCandles(s.symbol, 400)); if (p) found.push(p); } catch { /* skip */ }
        done++;
        if (done % 10 === 0) setProgress({ done, total: universe.length });
      }, () => stopRef.current);
      // Headlines for the strongest candidates, then re-score with the tone.
      const shortlist = topPicks(found, 12, 4);
      const rescored: IntradayPick[] = [];
      for (const p of shortlist) {
        let mood = 0;
        try {
          const j = await (await fetch(`/api/news?name=${encodeURIComponent(p.name)}`)).json();
          if (j.news) mood = newsMood(j.news).score;
        } catch { /* headlines are optional */ }
        const c = await fetchCandles(p.symbol, 400);
        const again = scoreIntraday(p.symbol, p.name, p.sector, c, mood);
        if (again) rescored.push(again);
      }
      const picks = topPicks(rescored, 5, 2);
      if (!picks.length) { toast.info("No stock qualified today. Sitting out is a valid trade."); setBatch(null); return; }
      const b: PickBatch = { forDate: picks[0].forDate, createdAt: Date.now(), picks };
      saveBatch(b);
      setBatch(b);
      toast.success(`${picks.length} picks for ${b.forDate}`);
    } finally { setRunning(false); setProgress(null); }
  }, [stocks]);

  const pot = acc?.pot ?? 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Picks for the next session</CardTitle>
        <CardDescription>Five liquid stocks in uptrends that closed strong on rising volume, with headline tone checked. Each has a buy-stop entry, a stop-loss and targets. Scan after the close, trade the next morning.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-32 space-y-1"><Label className="text-xs text-muted-foreground">Risk per trade (% of pot)</Label><NumberField min={0.25} max={3} step={0.25} value={riskPct} onChange={setRiskPct} /></div>
          <Button onClick={generate} disabled={running}>{running ? <Loader2 className="animate-spin" /> : <Play />}{running ? "Scanning…" : "Find picks"}</Button>
          {running && <Button variant="outline" onClick={() => { stopRef.current = true; }}>Stop</Button>}
          {progress && <span className="font-mono text-xs text-muted-foreground">{progress.done}/{progress.total}</span>}
        </div>
        {batch && (
          <>
            <p className="text-sm">For the session on <b>{batch.forDate}</b> (found {new Date(batch.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}).</p>
            <div className="grid gap-3 lg:grid-cols-2">
              {batch.picks.map((p) => {
                const size = intradaySize(pot, acc?.leverage ?? 5, riskPct, 5, p.plan);
                return (
                  <div key={p.symbol} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span><b className="font-mono text-base">{displaySymbol(p.symbol)}</b> <span className="text-xs text-muted-foreground">{p.sector}</span></span>
                      <span className="tabular font-mono text-sm">{p.score}<span className="text-xs text-muted-foreground">/100</span></span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 rounded-md bg-muted/50 p-2 text-xs">
                      <span><span className="text-muted-foreground">Buy above</span><b className="block font-mono text-sm">{p.plan.entry.toFixed(2)}</b></span>
                      <span><span className="text-muted-foreground">Stop</span><b className="block font-mono text-sm text-down">{p.plan.stop.toFixed(2)}</b></span>
                      <span><span className="text-muted-foreground">Target 1</span><b className="block font-mono text-sm text-up">{p.plan.target1.toFixed(2)}</b></span>
                      <span><span className="text-muted-foreground">Target 2</span><b className="block font-mono text-sm text-up">{p.plan.target2.toFixed(2)}</b></span>
                    </div>
                    <p className="text-xs text-muted-foreground">Risk {p.plan.riskPct.toFixed(2)}% · reward 1.5R · {size.qty} shares = {fmtInr(size.notional)} using {fmtInr(size.margin)} of your money. Risking {fmtInr(size.riskAmt)} to make {fmtInr(size.rewardAmt)}.</p>
                    <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">{p.reasons.slice(0, 4).map((r) => <li key={r}>{r}</li>)}</ul>
                    <p className="text-xs text-muted-foreground"><b>Skip it if</b> it opens above {(p.plan.entry * 1.01).toFixed(2)} or below {p.plan.stop.toFixed(2)}. Exit by 3:15 pm if neither level is hit.</p>
                    <Button size="sm" disabled={size.qty < 1} onClick={async () => {
                      const r = await place({ symbol: p.symbol, side: "buy", qty: size.qty, type: "stop", triggerPrice: p.plan.entry, validity: "day", stop: p.plan.stop, target: p.plan.target1 });
                      if (r.error) toast.error(r.error); else toast.success(`Order placed: buys ${size.qty} ${displaySymbol(p.symbol)} if it trades up to ${p.plan.entry.toFixed(2)}`);
                    }}>Place order (buy-stop, SL and TP attached)</Button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Open() {
  const { acc, quotes, closeNow, cancel } = useIntraday();
  if (!acc || (!acc.state.positions.length && !acc.state.orders.length)) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Open positions and orders</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {acc.state.positions.map((p) => {
          const ltp = quotes[p.symbol]?.price ?? p.entryPrice;
          const pnl = (ltp - p.entryPrice) * p.qty * (p.direction === "long" ? 1 : -1);
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <b className="min-w-24 font-mono">{displaySymbol(p.symbol)}</b>
              <span className="font-mono">{p.qty} @ {p.entryPrice.toFixed(2)} → {ltp.toFixed(2)}</span>
              <span className={cn("tabular font-mono", pnl >= 0 ? "text-up" : "text-down")}>{fmtInr(pnl, { sign: true })}</span>
              <span className="text-xs text-muted-foreground">SL {p.stop?.toFixed(2) ?? "—"} · TP {p.target?.toFixed(2) ?? "—"}</span>
              <Button size="xs" variant="outline" className="ml-auto" onClick={async () => { const r = await closeNow(p.id); if (r.error) toast.error(r.error); }}>Exit now</Button>
            </div>
          );
        })}
        {acc.state.orders.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center gap-x-4 text-sm text-muted-foreground">
            <b className="min-w-24 font-mono text-foreground">{displaySymbol(o.symbol)}</b>
            <span>{o.side} {o.qty} when price reaches {o.limitPrice.toFixed(2)}</span>
            <Button size="xs" variant="ghost" className="ml-auto" onClick={() => cancel(o.id)}>Cancel</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Results() {
  const { acc } = useIntraday();
  const days = useMemo(() => (acc ? pnlByDay(acc.state) : []), [acc]);
  if (!acc || !days.length) return null;
  const trades = [...acc.state.trades].sort((a, b) => b.exitTime - a.exitTime).slice(0, 30);
  const total = acc.state.trades.length, wins = acc.state.trades.filter((t) => t.netPnl > 0).length;
  return (
    <Card>
      <CardHeader><CardTitle>Your results</CardTitle><CardDescription>{total} trades, {total ? ((wins / total) * 100).toFixed(0) : 0}% winners. Charges and slippage are included.</CardDescription></CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Day</th><th className="text-right">Trades</th><th className="text-right">Wins</th><th className="text-right">P&amp;L</th></tr></thead>
          <tbody className="divide-y">{days.slice(0, 20).map((d) => <tr key={d.date}><td className="py-1">{d.date}</td><td className="tabular text-right font-mono">{d.trades}</td><td className="tabular text-right font-mono">{d.wins}</td><td className={cn("tabular text-right font-mono", d.pnl >= 0 ? "text-up" : "text-down")}>{fmtInr(d.pnl, { sign: true })}</td></tr>)}</tbody>
        </table>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Stock</th><th>How it ended</th><th className="text-right">P&amp;L</th></tr></thead>
          <tbody className="divide-y">{trades.map((t) => <tr key={t.id}><td className="py-1 font-mono">{displaySymbol(t.symbol)}</td><td className="text-xs text-muted-foreground">{t.reason === "target" ? "Target" : t.reason === "stop" ? "Stop" : t.reason === "squareoff" ? "3:15 close" : "Exited"}</td><td className={cn("tabular text-right font-mono", t.netPnl >= 0 ? "text-up" : "text-down")}>{fmtInr(t.netPnl, { sign: true })}</td></tr>)}</tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function Scorecard() {
  const [rows, setRows] = useState<{ date: string; symbol: string; res: PickResult }[] | null>(null);
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    try {
      const today = istToday();
      const out: { date: string; symbol: string; res: PickResult }[] = [];
      for (const b of loadBatches().filter((x) => x.forDate < today || x.forDate === today)) {
        for (const p of b.picks) {
          try {
            const bars = await fetchCandles(p.symbol, 40, "5m");
            const res = evaluatePick(p, bars);
            if (res) out.push({ date: b.forDate, symbol: p.symbol, res });
          } catch { /* no intraday data for this one */ }
        }
      }
      setRows(out.sort((a, b) => b.date.localeCompare(a.date)));
    } finally { setBusy(false); }
  }
  const s = rows ? summarize(rows.map((r) => r.res)) : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Are the suggestions working?</CardTitle>
        <CardDescription>Replays every saved pick on that day&apos;s 5-minute candles as if you had followed it exactly (entry, stop, first target, out by 3:15; stop assumed first when a candle touches both). Independent of what you actually traded. Needs a few weeks of picks to mean anything; free intraday history reaches back about 40 days.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="outline" onClick={check} disabled={busy}>{busy && <Loader2 className="animate-spin" />}Check past picks</Button>
        {s && rows && (rows.length === 0 ? <p className="text-sm text-muted-foreground">No saved picks have a finished session yet. Come back after a trading day.</p> : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Picks followed" value={`${s.taken} of ${s.evaluated}`} sub={`${s.skipped} never triggered or skipped`} />
              <Stat label="Winners" value={`${(s.winRate * 100).toFixed(0)}%`} sub={`${s.wins} won, ${s.losses} lost`} />
              <Stat label="Total result" value={`${s.totalR >= 0 ? "+" : ""}${s.totalR.toFixed(1)}R`} sub={`${s.avgR >= 0 ? "+" : ""}${s.avgR.toFixed(2)}R per trade`} tone={s.totalR >= 0 ? "up" : "down"} />
              <Stat label="Average move" value={fmtPct(s.avgPnlPct, 2, { sign: true })} sub="before charges" tone={s.avgPnlPct >= 0 ? "up" : "down"} />
            </div>
            <p className="text-xs text-muted-foreground">{s.taken < 30 ? `Only ${s.taken} trades so far: too few to tell skill from luck. Judge after 30 or more. ` : ""}1R is the amount risked on a trade. Intraday charges can eat most of a small edge.</p>
            <table className="w-full text-sm">
              <tbody className="divide-y">{rows.slice(0, 40).map((r) => <tr key={r.date + r.symbol}><td className="py-1 text-xs text-muted-foreground">{r.date}</td><td className="font-mono">{displaySymbol(r.symbol)}</td><td className="text-xs">{OUTCOME[r.res.outcome]}</td><td className={cn("tabular text-right font-mono", r.res.r > 0 ? "text-up" : r.res.r < 0 ? "text-down" : "")}>{r.res.r === 0 ? "—" : `${r.res.r > 0 ? "+" : ""}${r.res.r.toFixed(2)}R`}</td></tr>)}</tbody>
            </table>
          </>
        ))}
      </CardContent>
    </Card>
  );
}
