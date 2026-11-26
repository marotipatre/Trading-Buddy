import type { Idea } from "@/lib/analysis/ideas-engine";
import type { MarketRegime } from "@/lib/analysis/regime";
import type { SectorRow } from "@/lib/analysis/sectors";
import { cn } from "@/lib/utils";
import { pct } from "./shared";

function Cell({ label, children, sub, wide }: { label: string; children: React.ReactNode; sub?: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 space-y-0.5 rounded-xl border bg-card p-3.5 ${wide ? "col-span-2 lg:col-span-1" : ""}`}><div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div><div className="truncate text-lg font-semibold leading-tight">{children}</div>{sub && <div className="text-xs text-muted-foreground">{sub}</div>}</div>
  );
}

/** Four numbers that frame the day: the market's condition, how much of it is in an uptrend, the best sectors, how many setups. */
export function MarketStrip({ regime, bench, ideas, sectors, scanned }: { regime: MarketRegime | null; bench: number | null; ideas: Idea[]; sectors: SectorRow[]; scanned: number }) {
  const buys = ideas.filter((i) => i.v.verdict === "buy").length;
  const uptrend = ideas.length ? (ideas.filter((i) => i.v.aboveEma50).length / ideas.length) * 100 : 0;
  const top = sectors.filter((s) => s.stance === "focus").slice(0, 3);
  const tone = regime?.regime === "bull" ? "bg-up" : regime?.regime === "bear" ? "bg-down" : "bg-warn";
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Cell label="Market" sub={regime ? `Nifty ${regime.vs200 >= 0 ? "+" : ""}${regime.vs200.toFixed(1)}% vs its 200-day average` : "Reading the Nifty…"}>
        <span className="inline-flex items-center gap-2"><span className={cn("size-2.5 rounded-full", tone)} />{regime?.label ?? "…"}</span>
      </Cell>
      <Cell label="Buy setups" sub={`of ${ideas.length || scanned} stocks scanned`}>{buys}</Cell>
      <Cell label="In an uptrend" sub={bench !== null ? `Nifty ${pct(bench)} over a month` : undefined}>{ideas.length ? `${uptrend.toFixed(0)}%` : "…"}</Cell>
      <Cell wide label="Strongest sectors" sub={top.length ? `${top.slice(0, 3).map((s) => `${s.sector} ${pct(s.relM1, 0)}`).join(" · ")} vs Nifty (1 month)` : undefined}>{top.length ? `${top[0].sector} leads` : "…"}</Cell>
    </div>
  );
}
