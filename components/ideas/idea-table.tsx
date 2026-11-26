"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Idea } from "@/lib/analysis/ideas-engine";
import { displaySymbol } from "@/lib/symbols";
import { cn } from "@/lib/utils";
import { CAP_SHORT, ScoreRing, Trend, VERDICT_BG, VERDICT_LABEL, pct } from "./shared";

type Scope = "all" | "large" | "mid" | "small";
type Sort = "best" | "score" | "odds" | "month" | "rr";
const SORTS: { id: Sort; label: string }[] = [{ id: "best", label: "Best first" }, { id: "score", label: "Score" }, { id: "odds", label: "Past odds" }, { id: "month", label: "1-month move" }, { id: "rr", label: "Reward : risk" }];

const Chip = ({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button type="button" aria-pressed={on} onClick={onClick} className={cn("h-8 rounded-full border px-3 text-xs font-medium transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{children}</button>
);

/** Every scanned stock, filterable and sortable. */
export function IdeaTable({ ideas, sectorFilter, onSector, sectors, onOpen, days, target }: { ideas: Idea[]; sectorFilter: string | null; onSector: (s: string | null) => void; sectors: string[]; onOpen: (i: Idea) => void; days: number; target: number }) {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [verdict, setVerdict] = useState<"buy" | "watch" | "all">("all");
  const [sort, setSort] = useState<Sort>("best");
  const [limit, setLimit] = useState(60);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const f = ideas.filter((i) => (scope === "all" || i.cap === scope) && (verdict === "all" || i.v.verdict === verdict) && (!sectorFilter || i.sector === sectorFilter) && (!needle || `${i.symbol} ${i.name}`.toLowerCase().includes(needle)));
    const key: Record<Sort, (i: Idea) => number> = { best: () => 0, score: (i) => -i.v.score, odds: (i) => -(i.hz?.hitRate ?? -1), month: (i) => -(i.v.ret.m1 || -99), rr: (i) => -(i.v.plan?.rr1 ?? -1) };
    return sort === "best" ? f : [...f].sort((a, b) => key[sort](a) - key[sort](b));
  }, [ideas, q, scope, verdict, sort, sectorFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><input value={q} onChange={(e) => { setQ(e.target.value); setLimit(60); }} placeholder="Search name or symbol" aria-label="Search stocks" className="h-9 w-full rounded-lg border bg-background pl-8 pr-3 text-sm" /></div>
        <div className="flex gap-1.5">{(["all", "large", "mid", "small"] as Scope[]).map((s) => <Chip key={s} on={scope === s} onClick={() => setScope(s)}>{s === "all" ? "All sizes" : `${CAP_SHORT[s]} cap`}</Chip>)}</div>
        <div className="flex gap-1.5">{([["all", "All"], ["buy", "Buy setups"], ["watch", "Watch"]] as const).map(([k, l]) => <Chip key={k} on={verdict === k} onClick={() => setVerdict(k)}>{l}</Chip>)}</div>
        <select value={sectorFilter ?? ""} onChange={(e) => onSector(e.target.value || null)} aria-label="Sector" className="h-8 rounded-lg border bg-background px-2 text-xs"><option value="">All sectors</option>{sectors.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className="ml-auto h-8 rounded-lg border bg-background px-2 text-xs">{SORTS.map((s) => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}</select>
      </div>
      <p className="text-xs text-muted-foreground">{rows.length} stock{rows.length === 1 ? "" : "s"}. &ldquo;Past odds&rdquo; = how often this stock reached +{target}% within {days} days in its own last 3 years, before hitting its stop.</p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Stock</th><th className="font-medium">Verdict</th><th className="font-medium">Score</th><th className="font-medium">Trend</th><th className="text-right font-medium">Price</th><th className="text-right font-medium">1 month</th><th className="text-right font-medium">Past odds</th><th className="text-right font-medium">R : R</th><th className="px-3 text-right font-medium">Buy / stop / target</th></tr></thead>
          <tbody className="divide-y">
            {rows.slice(0, limit).map((i) => (
              <tr key={i.symbol} onClick={() => onOpen(i)} className="cursor-pointer transition-colors hover:bg-accent/40" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onOpen(i); }}>
                <td className="px-3 py-2"><div className="font-mono font-semibold">{displaySymbol(i.symbol)}</div><div className="max-w-44 truncate text-xs text-muted-foreground">{i.sector} · {CAP_SHORT[i.cap]}</div></td>
                <td><span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", VERDICT_BG[i.v.verdict])}>{VERDICT_LABEL[i.v.verdict]}</span></td>
                <td><ScoreRing score={i.v.score} verdict={i.v.verdict} size={32} /></td>
                <td><Trend frames={i.v.frames} /></td>
                <td className="tabular text-right font-mono">{i.v.price.toFixed(2)}</td>
                <td className={cn("tabular text-right font-mono", i.v.ret.m1 >= 0 ? "text-up" : "text-down")}>{pct(i.v.ret.m1)}</td>
                <td className="tabular text-right font-mono">{i.hz ? `${(i.hz.hitRate * 100).toFixed(0)}%` : "…"}</td>
                <td className="tabular text-right font-mono">{i.v.plan ? i.v.plan.rr1.toFixed(1) : "—"}</td>
                <td className="tabular px-3 text-right font-mono text-xs">{i.v.plan ? <><span>{i.v.plan.entry.toFixed(2)}</span> / <span className="text-down">{i.v.plan.stop.toFixed(2)}</span> / <span className="text-up">{i.v.plan.target1.toFixed(2)}</span></> : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-muted-foreground">No stock matches these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > limit && <Button variant="outline" onClick={() => setLimit((l) => l + 100)}>Show {Math.min(100, rows.length - limit)} more of {rows.length - limit}</Button>}
    </div>
  );
}
