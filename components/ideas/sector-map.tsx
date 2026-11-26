import type { SectorRow } from "@/lib/analysis/sectors";
import { cn } from "@/lib/utils";
import { pct } from "./shared";

/** A tile per sector, coloured by how it did against the Nifty over a month. Click to list only that sector. */
export function SectorMap({ sectors, selected, onSelect }: { sectors: SectorRow[]; selected: string | null; onSelect: (s: string | null) => void }) {
  if (!sectors.length) return <p className="text-sm text-muted-foreground">Sectors appear as the scan finds enough stocks in each.</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Colour = 1-month move against the Nifty 50 (green beat it, red lagged). Click a tile to filter the stock list.</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {sectors.map((sc) => {
          const k = Math.min(1, Math.abs(sc.relM1) / 10);
          const bg = `color-mix(in oklab, var(${sc.relM1 >= 0 ? "--up" : "--down"}) ${Math.round(12 + k * 52)}%, var(--card))`;
          const on = selected === sc.sector;
          return (
            <button key={sc.sector} type="button" onClick={() => onSelect(on ? null : sc.sector)} aria-pressed={on} style={{ backgroundColor: bg }}
              className={cn("rounded-xl border p-3 text-left transition-transform hover:-translate-y-0.5", on && "ring-2 ring-primary")}>
              <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold leading-tight">{sc.sector}</span>
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", sc.stance === "focus" ? "bg-up/25 text-up" : sc.stance === "avoid" ? "bg-down/25 text-down" : "bg-background/70 text-muted-foreground")}>{sc.stance === "focus" ? "FOCUS" : sc.stance === "avoid" ? "AVOID" : "NEUTRAL"}</span></div>
              <div className="tabular mt-1 font-mono text-lg font-semibold">{pct(sc.relM1)} <span className="text-xs font-normal text-muted-foreground">vs Nifty</span></div>
              <div className="text-[11px] text-muted-foreground">{pct(sc.m1)} in a month · {sc.breadth.toFixed(0)}% in uptrend · {sc.buys}/{sc.stocks} buy setups</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
