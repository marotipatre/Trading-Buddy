import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Info } from "@/components/ui/info";
import type { Idea, Plan } from "@/lib/analysis/ideas-engine";
import { planToQuery } from "@/lib/plan-link";
import { displaySymbol } from "@/lib/symbols";
import { cn } from "@/lib/utils";
import { CAP_SHORT, PlanMeter, ScoreRing, VERDICT_BG, VERDICT_LABEL, pct } from "./shared";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: n >= 1000 ? 0 : 2 })}`;

/** "Up on day, week and month", or which timeframes disagree, in words instead of arrows. */
function trendWords(f: Idea["v"]["frames"]): { text: string; tone: "up" | "down" | "flat" } {
  const names = { daily: "day", weekly: "week", monthly: "month" } as const;
  const ups = (["daily", "weekly", "monthly"] as const).filter((k) => f[k] === "up").map((k) => names[k]);
  const downs = (["daily", "weekly", "monthly"] as const).filter((k) => f[k] === "down").map((k) => names[k]);
  const join = (a: string[]) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}` : a[0]);
  if (ups.length === 3) return { text: "Rising on day, week and month charts", tone: "up" };
  if (downs.length === 3) return { text: "Falling on day, week and month charts", tone: "down" };
  if (ups.length) return { text: `Rising on the ${join(ups)} chart${ups.length > 1 ? "s" : ""}${downs.length ? `, falling on the ${join(downs)}` : ""}`, tone: ups.length >= 2 ? "up" : "flat" };
  return { text: downs.length ? `Falling on the ${join(downs)} chart${downs.length > 1 ? "s" : ""}` : "No clear trend", tone: downs.length ? "down" : "flat" };
}

/** One recommended stock: the plan in rupees, the stock's own past odds in a sentence, and the detail behind a button. */
export function IdeaCard({ idea, plan, rank, onOpen }: { idea: Idea; plan: Plan; rank: number; onOpen: () => void }) {
  const v = idea.v, p = v.plan;
  const trend = trendWords(v.frames);
  const stopPct = p ? (p.stop / p.entry - 1) * 100 : 0, targetPct = p ? (p.target1 / p.entry - 1) * 100 : 0;
  const onDip = p ? p.entry < v.price * 0.995 : false;
  const conf = idea.conviction === "high" ? "High confidence" : idea.conviction === "medium" ? "Medium confidence" : "Low confidence";
  return (
    <article className="flex flex-col gap-4 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40">
      <header className="flex items-start gap-3">
        <ScoreRing score={v.score} verdict={v.verdict} size={46} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-heading text-lg font-semibold leading-tight"><span className="mr-1.5 text-sm font-normal text-muted-foreground">#{rank}</span>{displaySymbol(idea.symbol)}</h3>
          <p className="truncate text-xs text-muted-foreground">{idea.name} · {idea.sector} · {CAP_SHORT[idea.cap]} cap</p>
        </div>
        <div className="text-right">
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", VERDICT_BG[v.verdict])}>{VERDICT_LABEL[v.verdict]}</span>
          <div className="mt-1 text-[11px] text-muted-foreground">{conf}</div>
        </div>
      </header>

      <div className="flex items-baseline justify-between gap-3">
        <span className="figure text-[1.7rem] leading-none">{inr(v.price)}</span>
        <span className={cn("text-xs", trend.tone === "up" ? "text-up" : trend.tone === "down" ? "text-down" : "text-muted-foreground")}>{trend.text}</span>
      </div>

      {p && (
        <div className="space-y-2">
          <PlanMeter stop={p.stop} entry={p.entry} target={p.target1} price={v.price} />
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><div className="text-xs text-muted-foreground">Stop-loss</div><div className="figure text-down">{inr(p.stop)}</div><div className="text-[11px] text-muted-foreground">{pct(stopPct)} if wrong</div></div>
            <div className="text-center"><div className="text-xs text-muted-foreground">{onDip ? "Buy on a dip to" : "Buy near"}</div><div className="figure">{inr(p.entry)}</div><div className="text-[11px] text-muted-foreground">gain is {p.rr1.toFixed(1)}× the risk</div></div>
            <div className="text-right"><div className="text-xs text-muted-foreground">Target</div><div className="figure text-up">{inr(p.target1)}</div><div className="text-[11px] text-muted-foreground">{pct(targetPct)} if right</div></div>
          </div>
        </div>
      )}

      <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        {idea.hz ? (
          <>In its own past {plan.days}-day windows this stock reached the target before the stop <b className="text-foreground">{Math.round(idea.hz.hitRate * 100)} times in 100</b>, averaging <b className={idea.hz.expectancyPct >= 0 ? "text-up" : "text-down"}>{pct(idea.hz.expectancyPct)}</b> per trade. History, not a forecast.</>
        ) : "Checking how this stock behaved in the past…"}
      </p>

      <div className="flex items-center gap-2 text-xs">
        {idea.bb.bear[0] ? <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground"><span className="size-1.5 shrink-0 rounded-full bg-warn" /><span className="truncate">{idea.bb.bear[0]}</span></span> : <span className="text-muted-foreground">No warnings found</span>}
        <Info label="Why" title={`${displaySymbol(idea.symbol)}: why it ranks here`} align="end" className="ml-auto">
          {idea.bb.bull.length > 0 && <><p><b>For</b></p><ul className="list-disc space-y-1 pl-4">{idea.bb.bull.map((w) => <li key={w}>{w}</li>)}</ul></>}
          {idea.bb.bear.length > 0 && <><p><b>Against</b></p><ul className="list-disc space-y-1 pl-4">{idea.bb.bear.map((w) => <li key={w}>{w}</li>)}</ul></>}
          <p>Score {v.score} out of 100 from trend, momentum and relative strength. The stop-loss is where the idea is proven wrong; the target is the first place to take profit.</p>
        </Info>
      </div>

      <footer className="mt-auto flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onOpen}>Full analysis</Button>
        <Button size="sm" className="flex-1" nativeButton={false} render={<Link href={`/trade?symbol=${encodeURIComponent(idea.symbol)}${p ? `&${planToQuery({ entry: p.entry, stop: p.stop, target: p.target1 })}` : ""}`} />}>Chart and trade</Button>
      </footer>
    </article>
  );
}
