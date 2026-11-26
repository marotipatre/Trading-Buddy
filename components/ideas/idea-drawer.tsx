"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExplainButton } from "@/components/coach/explain-button";
import { NewsPanel } from "@/components/news/news-panel";
import type { Idea, Plan } from "@/lib/analysis/ideas-engine";
import { positionSize } from "@/lib/analysis/stock-view";
import { fmtInr } from "@/lib/format";
import { planToQuery } from "@/lib/plan-link";
import { displaySymbol } from "@/lib/symbols";
import { cn } from "@/lib/utils";
import { CAP_SHORT, Conviction, PlanMeter, ScoreRing, Trend, VERDICT_BG, VERDICT_LABEL, pct } from "./shared";

/** Everything known about one stock, in a panel beside the list so you never lose your place. */
export function IdeaDrawer({ idea, plan, amount, risk, onClose }: { idea: Idea; plan: Plan; amount: number; risk: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  const v = idea.v, p = v.plan, bb = idea.bb;
  const size = p ? positionSize(amount, risk, 25, p) : null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${displaySymbol(idea.symbol)} analysis`}>
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full flex-col overflow-y-auto border-l bg-card shadow-2xl sm:w-[560px]">
        <header className="sticky top-0 z-10 flex items-start gap-3 border-b bg-card/95 p-4 backdrop-blur">
          <ScoreRing score={v.score} verdict={v.verdict} size={52} />
          <div className="min-w-0 flex-1">
            <h2 className="font-mono text-lg font-semibold">{displaySymbol(idea.symbol)}</h2>
            <p className="truncate text-sm text-muted-foreground">{idea.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs"><span className={cn("rounded-md px-2 py-0.5 font-semibold", VERDICT_BG[v.verdict])}>{VERDICT_LABEL[v.verdict]}</span><Conviction level={idea.conviction} /><span className="text-muted-foreground">{idea.sector} · {CAP_SHORT[idea.cap]} cap</span><Trend frames={v.frames} /></div>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}><X /></Button>
        </header>

        <div className="space-y-5 p-4">
          {p ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">The plan</h3>
              <PlanMeter stop={p.stop} entry={p.entry} target={p.target1} price={v.price} />
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div className="rounded-lg bg-muted/50 p-2.5"><div className="text-[11px] text-muted-foreground">{p.entryKind === "now" ? "Buy near" : "Buy on a dip to"}</div><b className="font-mono">{p.entry.toFixed(2)}</b></div>
                <div className="rounded-lg bg-muted/50 p-2.5"><div className="text-[11px] text-muted-foreground">Stop-loss</div><b className="font-mono text-down">{p.stop.toFixed(2)}</b> <span className="text-xs text-muted-foreground">−{p.riskPct.toFixed(1)}%</span></div>
                <div className="rounded-lg bg-muted/50 p-2.5"><div className="text-[11px] text-muted-foreground">Target</div><b className="font-mono text-up">{p.target1.toFixed(2)}</b> <span className="text-xs text-muted-foreground">+{p.rewardPct1.toFixed(1)}%</span></div>
                <div className="rounded-lg bg-muted/50 p-2.5"><div className="text-[11px] text-muted-foreground">Reward : risk</div><b className="font-mono">{p.rr1.toFixed(1)} : 1</b></div>
              </div>
              {size && size.qty > 0 && <p className="text-sm">With {fmtInr(amount)} at {risk}% risk: <b>{size.qty} shares</b> ({fmtInr(size.value)}); being stopped out costs about {fmtInr(size.risk)}.</p>}
              <div className="flex gap-2">
                <Button className="flex-1" nativeButton={false} render={<Link href={`/trade?symbol=${encodeURIComponent(idea.symbol)}&${planToQuery({ entry: p.entry, stop: p.stop, target: p.target1 })}`} />}>Open chart with this plan</Button>
              </div>
            </section>
          ) : <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">No clean stop level to plan around right now.</p>}

          {idea.hz && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">What happened before, to this stock</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border p-2.5"><div className="font-mono text-lg font-semibold text-up">{(idea.hz.hitRate * 100).toFixed(0)}%</div><div className="text-[11px] text-muted-foreground">reached +{plan.target}% in {plan.days} days</div></div>
                <div className="rounded-lg border p-2.5"><div className="font-mono text-lg font-semibold text-down">{(idea.hz.stopRate * 100).toFixed(0)}%</div><div className="text-[11px] text-muted-foreground">hit the stop first</div></div>
                <div className="rounded-lg border p-2.5"><div className={cn("font-mono text-lg font-semibold", idea.hz.expectancyPct >= 0 ? "text-up" : "text-down")}>{pct(idea.hz.expectancyPct)}</div><div className="text-[11px] text-muted-foreground">average per trade</div></div>
              </div>
              <p className="text-xs text-muted-foreground">From {idea.hz.samples} overlapping {plan.days}-day windows in its last 3 years{Number.isFinite(idea.hz.hitRateUptrend) ? `; ${(idea.hz.hitRateUptrend * 100).toFixed(0)}% when it started in an uptrend` : ""}. Mostly a rising market, so it flatters.</p>
            </section>
          )}

          <section className="space-y-2">
            <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">Both sides of the case</h3><span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", bb.lean === "favours buying" ? "bg-up/15 text-up" : bb.lean === "favours caution" ? "bg-down/15 text-down" : "bg-muted text-muted-foreground")}>{bb.lean}</span></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><div className="mb-1 text-xs font-medium text-up">Bull ({bb.bull.length})</div><ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">{bb.bull.length ? bb.bull.map((t) => <li key={t}>{t}</li>) : <li>Nothing strong</li>}</ul></div>
              <div><div className="mb-1 text-xs font-medium text-down">Bear ({bb.bear.length})</div><ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">{bb.bear.length ? bb.bear.map((t) => <li key={t}>{t}</li>) : <li>Nothing strong</li>}</ul></div>
            </div>
            {idea.patterns.length > 0 && <p className="text-xs text-muted-foreground">Latest candle: {idea.patterns.map((x) => x.name).join(", ")}.</p>}
            <ExplainButton kind="idea" data={{ symbol: idea.symbol, verdict: v.verdict, score: v.score, bull: bb.bull, bear: bb.bear, lean: bb.lean, plan: p ? { entry: +p.entry.toFixed(2), stop: +p.stop.toFixed(2), target: +p.target1.toFixed(2), rr: +p.rr1.toFixed(1) } : null, history: idea.hz ? { hitRatePct: +(idea.hz.hitRate * 100).toFixed(0), stopRatePct: +(idea.hz.stopRate * 100).toFixed(0), avgResultPct: +idea.hz.expectancyPct.toFixed(1), days: plan.days, targetPct: plan.target } : null }} />
            <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Where these numbers come from</summary><ul className="mt-1 list-disc space-y-0.5 pl-4">{bb.provenance.map((t) => <li key={t}>{t}</li>)}</ul></details>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">How the score was built</h3>
            <ul className="space-y-1 text-sm">{v.reasons.map((r) => <li key={r.text} className="flex gap-2"><span className={cn("w-8 shrink-0 text-right font-mono text-xs", r.points >= 0 ? "text-up" : "text-down")}>{r.points > 0 ? "+" : ""}{r.points}</span><span className="text-muted-foreground">{r.text}</span></li>)}</ul>
            <p className="text-xs text-muted-foreground">1 week {pct(v.ret.w1)} · 1 month {pct(v.ret.m1)} · 3 months {pct(v.ret.m3)} · 6 months {pct(v.ret.m6)} · RSI {v.rsi.toFixed(0)}</p>
          </section>

          <NewsPanel name={idea.name} price={v.price} />
        </div>
      </aside>
    </div>
  );
}
