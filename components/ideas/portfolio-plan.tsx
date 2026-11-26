import Link from "next/link";
import type { Idea, Plan } from "@/lib/analysis/ideas-engine";
import type { Mix } from "@/lib/analysis/portfolio-mix";
import { fmtInr } from "@/lib/format";
import { planToQuery } from "@/lib/plan-link";
import { displaySymbol } from "@/lib/symbols";
import { cn } from "@/lib/utils";

export interface Expectation { invested: number; expected: number; expectedPct: number; hitRate: number; stopRate: number; trades: number }

/** The best setups spread over sectors, sized to your amount, and what that mix has historically produced over your period. */
export function PortfolioPlan({ mix, expectation, ideas, plan, amount, riskNote, onOpen }: { mix: Mix; expectation: Expectation | null; ideas: Idea[]; plan: Plan; amount: number; riskNote?: string; onOpen: (i: Idea) => void }) {
  if (!mix.picks.length) return <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">No mix to build yet. It needs buy setups in sectors that are not marked Avoid, with a positive past record over {plan.days} days. Try a longer period or a smaller target.</p>;
  return (
    <div className="space-y-4">
      {expectation && (
        <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-4">
          <div><div className="text-xs text-muted-foreground">Typical result, {plan.days} days</div><div className={cn("tabular font-mono text-xl font-semibold", expectation.expected >= 0 ? "text-up" : "text-down")}>{fmtInr(expectation.expected, { sign: true })}</div><div className="text-xs text-muted-foreground">{expectation.expectedPct >= 0 ? "+" : ""}{expectation.expectedPct.toFixed(1)}% of {fmtInr(amount)}</div></div>
          <div><div className="text-xs text-muted-foreground">Reached +{plan.target}%</div><div className="font-mono text-xl font-semibold">{(expectation.hitRate * 100).toFixed(0)}%</div><div className="text-xs text-muted-foreground">of past windows</div></div>
          <div><div className="text-xs text-muted-foreground">Hit the stop first</div><div className="font-mono text-xl font-semibold text-down">{(expectation.stopRate * 100).toFixed(0)}%</div><div className="text-xs text-muted-foreground">of past windows</div></div>
          <div><div className="text-xs text-muted-foreground">If all targets / all stops</div><div className="tabular font-mono text-sm"><span className="text-up">{fmtInr(mix.rewardIfTarget1, { sign: true })}</span> / <span className="text-down">{fmtInr(-mix.riskIfAllStopped, { sign: true })}</span></div><div className="text-xs text-muted-foreground">best and worst case</div></div>
          {expectation.hitRate < 0.4 && <p className="text-xs text-warn sm:col-span-4">A {plan.target}% move in {plan.days} days is a stretch for these stocks (reached in {(expectation.hitRate * 100).toFixed(0)}% of past windows). A lower target or longer period gives better odds.</p>}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Stock</th><th className="font-medium">Sector</th><th className="text-right font-medium">Buy at</th><th className="text-right font-medium">Stop</th><th className="text-right font-medium">Target</th><th className="text-right font-medium">Shares</th><th className="px-3 text-right font-medium">Weight</th></tr></thead>
          <tbody className="divide-y">
            {mix.picks.map((p) => {
              const idea = ideas.find((i) => i.symbol === p.symbol);
              return (
                <tr key={p.symbol} className="cursor-pointer hover:bg-accent/40" onClick={() => idea && onOpen(idea)}>
                  <td className="px-3 py-2 font-mono font-semibold">{displaySymbol(p.symbol)}</td><td className="text-xs text-muted-foreground">{p.sector}</td>
                  <td className="tabular text-right font-mono">{p.view.plan!.entry.toFixed(2)}</td><td className="tabular text-right font-mono text-down">{p.view.plan!.stop.toFixed(2)}</td><td className="tabular text-right font-mono text-up">{p.view.plan!.target1.toFixed(2)}</td>
                  <td className="tabular text-right font-mono">{p.qty}</td><td className="tabular px-3 text-right font-mono">{p.weightPct.toFixed(0)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{mix.picks.length} stocks in {mix.sectors.length} sectors, {fmtInr(mix.invested)} invested, {fmtInr(mix.cash)} kept as cash (10%). Sector mix: {mix.sectors.map((s) => `${s.sector} ${s.weightPct.toFixed(0)}%`).join(" · ")}. {riskNote}</p>
      <p className="text-xs text-muted-foreground">Open each stock to place its paper order with the plan filled in: <Link className="underline" href={`/trade?symbol=${encodeURIComponent(mix.picks[0].symbol)}&${planToQuery({ entry: mix.picks[0].view.plan!.entry, stop: mix.picks[0].view.plan!.stop, target: mix.picks[0].view.plan!.target1 })}`}>start with {displaySymbol(mix.picks[0].symbol)}</Link>.</p>
    </div>
  );
}
