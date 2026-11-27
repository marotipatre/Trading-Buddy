"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { SectorsPayload } from "@/lib/sectors/load";
import type { Quadrant, SectorOutlook as Outlook } from "@/lib/sectors/outlook";
import { SECTOR_INDICES } from "@/lib/sectors/outlook";
import { cn } from "@/lib/utils";

const pct = (n: number, d = 1) => (Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(d)}%` : "—");
const QUAD: Record<Quadrant, { label: string; cls: string; hint: string }> = {
  leading: { label: "Strong and rising", cls: "bg-up/15 text-up", hint: "Stronger than the market and still gaining" },
  improving: { label: "Weak but recovering", cls: "bg-primary/15 text-primary", hint: "Still behind the market but gaining fast: early rotation in" },
  weakening: { label: "Strong but fading", cls: "bg-warn/15 text-warn", hint: "Stronger than the market but losing steam" },
  lagging: { label: "Weak and falling", cls: "bg-down/15 text-down", hint: "Behind the market and still falling back" },
};
const STANCE = { overweight: "bg-up/15 text-up", neutral: "bg-muted text-muted-foreground", underweight: "bg-down/15 text-down" } as const;

/** A plain ranked chart: how much each sector beat (or lagged) the market over 3 months, with a one-word trend. */
function SectorBars({ sectors, selected, onSelect }: { sectors: Outlook[]; selected: string | null; onSelect: (i: string | null) => void }) {
  const max = Math.max(5, ...sectors.map((s) => Math.abs(s.vsBench.m3))) * 1.05;
  const rows = [...sectors].sort((a, b) => b.vsBench.m3 - a.vsBench.m3);
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold">Who is beating the market?</h3>
      <p className="mb-3 text-xs text-muted-foreground">Each bar is a sector&apos;s 3-month return minus the market&apos;s. Right (green) means it did better than the market, left (red) means worse.</p>
      <ul className="space-y-1">
        {rows.map((s) => {
          const v = s.vsBench.m3, w = (Math.abs(v) / max) * 50, on = selected === s.index;
          return (
            <li key={s.index}>
              <button type="button" onClick={() => onSelect(on ? null : s.index)} className={cn("grid w-full grid-cols-[6.5rem_1fr_3.2rem] items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-accent/50", on && "bg-accent/60")}>
                <span className="truncate font-medium">{s.label}</span>
                <span className="relative h-3.5 rounded-sm bg-muted/60">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
                  <span className={cn("absolute inset-y-0 rounded-sm", v >= 0 ? "bg-up" : "bg-down")} style={v >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
                </span>
                <span className={cn("tabular text-right font-mono", v >= 0 ? "text-up" : "text-down")}>{pct(v)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">Tap a sector for the reasons. &quot;Rising&quot; sectors are gaining on the market right now, &quot;Fading&quot; ones are losing ground.</p>
    </div>
  );
}

/** Sector outlook from NSE's own sector indices: performance over several periods, rotation quadrant, trend and valuation. */
export function SectorOutlook({ data, loading, error, onShowStocks }: { data: SectorsPayload | null; loading: boolean; error: string | null; onShowStocks: (universeSector: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  if (loading && !data) return <div className="space-y-3"><Skeleton className="h-24 w-full rounded-xl" /><Skeleton className="h-72 w-full rounded-xl" /></div>;
  if (!data) return <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">{error ?? "Sector data is unavailable."}</p>;
  const b = data.benchmark, br = data.breadth;
  const sel = data.sectors.find((s) => s.index === selected);
  const universeSector = (idx: string) => SECTOR_INDICES.find((x) => x.index === idx)?.sector;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4"><div className="text-sm text-muted-foreground">{b.index} (the market)</div><div className="mt-2 grid grid-cols-4 gap-2">{(["w1", "m1", "m3", "y1"] as const).map((k) => <div key={k}><div className="text-xs text-muted-foreground">{k === "w1" ? "1 week" : k === "m1" ? "1 month" : k === "m3" ? "3 months" : "1 year"}</div><div className={cn("figure text-lg", b.returns[k] >= 0 ? "text-up" : "text-down")}>{pct(b.returns[k])}</div></div>)}</div></div>
        <div className="rounded-2xl border bg-card p-4"><div className="text-sm text-muted-foreground">Market breadth, all NSE stocks</div>{br ? <><div className="mt-1 text-sm"><b className="text-up">{br.advances}</b> up · <b className="text-down">{br.declines}</b> down <span className="text-xs text-muted-foreground">({br.adRatio.toFixed(2)} advance/decline)</span></div><div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-muted"><span className="bg-up" style={{ width: `${(br.advances / br.total) * 100}%` }} /><span className="bg-down" style={{ width: `${(br.declines / br.total) * 100}%` }} /></div></> : <div className="text-sm text-muted-foreground">Unavailable</div>}</div>
        <div className="rounded-2xl border bg-card p-4"><div className="text-sm text-muted-foreground">India VIX (fear gauge)</div>{data.vix ? <div className="mt-1 text-sm"><b className="font-mono text-lg">{data.vix.level.toFixed(1)}</b> <span className={cn("text-xs", (data.vix.change1dPct ?? 0) >= 0 ? "text-down" : "text-up")}>{data.vix.change1dPct !== undefined ? pct(data.vix.change1dPct) : ""} today</span><div className="text-xs text-muted-foreground">{data.vix.level < 14 ? "Calm" : data.vix.level < 20 ? "Normal" : data.vix.level < 25 ? "Nervous" : "Fearful"}</div></div> : <div className="text-sm text-muted-foreground">Unavailable</div>}</div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[620px] border-separate border-spacing-0 text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Sector</th><th className="font-medium">View</th>
                {(["1 week", "1 month", "3 months", "6 months", "1 year"] as const).map((l) => <th key={l} className="px-1 text-center font-medium">{l}</th>)}
                <th className="px-4 text-right font-medium" title="Price divided by earnings for the sector index">P/E</th>
              </tr>
            </thead>
            <tbody>
              {data.sectors.map((s) => (
                <tr key={s.index} onClick={() => setSelected(selected === s.index ? null : s.index)} className={cn("cursor-pointer transition-colors hover:bg-accent/40", selected === s.index && "bg-accent/50")} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setSelected(selected === s.index ? null : s.index); }}>
                  <td className="border-t px-4 py-2.5 font-medium">{s.label}</td>
                  <td className="border-t"><span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STANCE[s.stance])} title={`Score ${s.score} out of 100`}>{s.stance === "overweight" ? "Favour" : s.stance === "underweight" ? "Avoid" : "Neutral"}</span></td>
                  {(["w1", "m1", "m3", "m6", "y1"] as const).map((k) => {
                    const v = s.returns[k];
                    const strength = Number.isFinite(v) ? Math.min(38, Math.abs(v) * (k === "w1" ? 6 : k === "m1" ? 3 : k === "m3" ? 1.8 : 1.1)) : 0;
                    return (
                      <td key={k} className="border-t px-1 py-1.5" title={`${pct(v)} vs the market's ${pct(data.benchmark.returns[k])}: ${pct(s.vsBench[k])}`}>
                        <div className="figure rounded-md py-1.5 text-center text-[13px]" style={{ backgroundColor: `color-mix(in oklab, var(${v >= 0 ? "--up" : "--down"}) ${strength}%, transparent)` }}>{pct(v)}</div>
                      </td>
                    );
                  })}
                  <td className="figure border-t px-4 text-right text-[13px]" title={s.valuation ? `${s.valuation} against its own recent range` : undefined}>{s.pe ? s.pe.toFixed(1) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3">
          <SectorBars sectors={data.sectors} selected={selected} onSelect={setSelected} />
        </div>
      </div>

      {sel && (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3"><h3 className="text-base font-semibold">{sel.label}</h3><span className={cn("rounded px-2 py-0.5 text-xs font-semibold", QUAD[sel.quadrant].cls)}>{QUAD[sel.quadrant].label}</span><span className="text-xs text-muted-foreground">{QUAD[sel.quadrant].hint}</span>
            {universeSector(sel.index) && <button type="button" className="ml-auto text-sm text-primary underline" onClick={() => onShowStocks(universeSector(sel.index)!)}>See the stocks in this sector</button>}</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{sel.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Source: {data.source}, as of {data.asOf}. How to read it: sector analysis is the standard top-down approach (market, then sector, then stock). A stock in a leading sector has a tailwind; the same stock in a lagging sector fights a headwind. Scores combine relative returns, the rotation quadrant, trend and valuation against the sector&apos;s own history. Information for learning, not advice.</p>
    </div>
  );
}
