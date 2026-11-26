"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUniverse } from "@/components/use-universe";
import { fetchCandles, pool } from "@/lib/analysis/candle-cache";
import { factorLab, FACTOR_LABEL, verdict, type FactorLab } from "@/lib/analysis/factor-lab";
import type { Candle } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const TONE = { works: "bg-up/15 text-up", weak: "bg-warn/15 text-warn", fails: "bg-down/15 text-down" } as const;
const sgn = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

/** Tests the ranking ideas on past data: does the top fifth by each factor really beat the bottom fifth afterwards? */
export function FactorLabCard() {
  const { stocks } = useUniverse();
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(0);
  const [lab, setLab] = useState<FactorLab | null | undefined>(undefined);
  async function run() {
    const list = (stocks ?? []).filter((s) => s.cap === "large" || s.cap === "mid").slice(0, 200);
    if (!list.length) return;
    setBusy(true); setProg(0);
    try {
      const series: Record<string, Candle[]> = {};
      let n = 0;
      await pool(list, 10, async (s) => { try { const c = await fetchCandles(s.symbol, 1800); if (c.length >= 330) series[s.symbol] = c; } catch { /* skip */ } setProg(++n / list.length); });
      setLab(factorLab(series));
    } finally { setBusy(false); }
  }
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold">Does our ranking actually work?</h3>
        <p className="text-sm text-muted-foreground">Every month, using only what was known then, we rank about 200 large and mid caps over up to five years on each idea, split them into five groups, and see how each group did over the next month. If an idea works, the top group beats the bottom group again and again, not once.</p>
      </div>
      <Button variant="outline" onClick={run} disabled={busy}>{busy && <Loader2 className="animate-spin" />}{busy ? `Testing… ${Math.round(prog * 100)}%` : lab ? "Run again" : "Run the test"}</Button>
      {lab === null && <p className="text-sm text-muted-foreground">Not enough history was available to run the test.</p>}
      {lab && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{lab.universe} stocks, {lab.periods} monthly tests. The average stock moved {sgn(lab.avgAll)} a month.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1 font-medium">Idea</th><th className="font-medium">Worst fifth</th><th className="font-medium">Middle</th><th className="font-medium">Best fifth</th><th className="font-medium">Best minus worst</th><th className="font-medium">Verdict</th></tr></thead>
              <tbody className="divide-y">
                {lab.factors.map((f) => { const v = verdict(f); return (
                  <tr key={f.id}>
                    <td className="py-2 pr-2 font-medium">{FACTOR_LABEL[f.id]}</td>
                    <td className="tabular font-mono">{sgn(f.quintiles[0].avgFwd)}</td><td className="tabular font-mono">{sgn(f.quintiles[2].avgFwd)}</td><td className="tabular font-mono">{sgn(f.quintiles[4].avgFwd)}</td>
                    <td className={cn("tabular font-mono font-semibold", f.spread >= 0 ? "text-up" : "text-down")}>{sgn(f.spread)}</td>
                    <td><span className={cn("rounded px-2 py-0.5 text-xs font-semibold", TONE[v.tone])} title={v.text}>{v.tone === "works" ? "Works" : v.tone === "weak" ? "Weak" : "No edge"}</span></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">{lab.factors.map((f) => <li key={f.id}><b className="text-foreground">{FACTOR_LABEL[f.id]}:</b> {verdict(f).text}</li>)}</ul>
          <p className="text-xs text-muted-foreground">Limits: today&apos;s stocks only (companies that fell out of the index are missing, which flatters the results), no trading costs, and a few years of one market. A result that works here is a reason to keep using an idea, not proof it will keep working.</p>
        </div>
      )}
    </div>
  );
}
