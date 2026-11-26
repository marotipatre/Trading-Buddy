import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Idea, Plan } from "@/lib/analysis/ideas-engine";
import { planToQuery } from "@/lib/plan-link";
import { displaySymbol } from "@/lib/symbols";
import { cn } from "@/lib/utils";
import { CAP_SHORT, Conviction, PlanMeter, ScoreRing, Trend, VERDICT_BG, VERDICT_LABEL, pct } from "./shared";

/** One recommended stock: what it is, why, the plan to scale, and the stock's own past odds. */
export function IdeaCard({ idea, plan, rank, onOpen }: { idea: Idea; plan: Plan; rank: number; onOpen: () => void }) {
  const v = idea.v, p = v.plan;
  const why = idea.bb.bull.slice(0, 3);
  return (
    <article className="group flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <header className="flex items-start gap-3">
        <ScoreRing score={v.score} verdict={v.verdict} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="font-mono text-[11px] text-muted-foreground">#{rank}</span><h3 className="truncate font-mono text-base font-semibold">{displaySymbol(idea.symbol)}</h3></div>
          <p className="truncate text-xs text-muted-foreground">{idea.name}</p>
        </div>
        <div className="flex flex-col items-end gap-1"><span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", VERDICT_BG[v.verdict])}>{VERDICT_LABEL[v.verdict]}</span><Conviction level={idea.conviction} /></div>
      </header>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5">{idea.sector}</span><span className="rounded bg-muted px-1.5 py-0.5">{CAP_SHORT[idea.cap]} cap</span><Trend frames={v.frames} />
        <span className="ml-auto tabular font-mono text-foreground">₹{v.price.toFixed(2)}</span>
      </div>

      {p && <PlanMeter stop={p.stop} entry={p.entry} target={p.target1} price={v.price} />}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/50 p-2"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Reward : risk</div><div className="font-mono text-sm font-semibold">{p ? `${p.rr1.toFixed(1)} : 1` : "—"}</div></div>
        <div className="rounded-lg bg-muted/50 p-2"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Reached +{plan.target}%</div><div className="font-mono text-sm font-semibold">{idea.hz ? `${(idea.hz.hitRate * 100).toFixed(0)}%` : "…"}</div></div>
        <div className="rounded-lg bg-muted/50 p-2"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg per trade</div><div className={cn("font-mono text-sm font-semibold", idea.hz && (idea.hz.expectancyPct >= 0 ? "text-up" : "text-down"))}>{idea.hz ? pct(idea.hz.expectancyPct) : "…"}</div></div>
      </div>

      {why.length > 0 && <ul className="space-y-1 text-xs text-muted-foreground">{why.map((w) => <li key={w} className="flex gap-1.5"><span className="mt-0.5 text-up">✓</span><span>{w}</span></li>)}</ul>}
      {idea.bb.bear.length > 0 && <p className="text-xs text-muted-foreground"><span className="text-down">Watch out:</span> {idea.bb.bear[0]}</p>}

      <footer className="mt-auto flex gap-2 pt-1">
        <Button size="sm" variant="outline" className="flex-1" onClick={onOpen}>Full analysis</Button>
        <Button size="sm" className="flex-1" nativeButton={false} render={<Link href={`/trade?symbol=${encodeURIComponent(idea.symbol)}${p ? `&${planToQuery({ entry: p.entry, stop: p.stop, target: p.target1 })}` : ""}`} />}>Chart &amp; trade</Button>
      </footer>
    </article>
  );
}
