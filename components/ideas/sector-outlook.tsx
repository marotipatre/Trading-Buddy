"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { SectorsPayload } from "@/lib/sectors/load";
import type { Quadrant, SectorOutlook as Outlook } from "@/lib/sectors/outlook";
import { SECTOR_INDICES } from "@/lib/sectors/outlook";
import { cn } from "@/lib/utils";

const pct = (n: number, d = 1) => (Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(d)}%` : "—");
const QUAD: Record<Quadrant, { label: string; cls: string; hint: string }> = {
  leading: { label: "Leading", cls: "bg-up/15 text-up", hint: "Stronger than the market and still gaining" },
  improving: { label: "Improving", cls: "bg-primary/15 text-primary", hint: "Still behind the market but gaining fast: early rotation in" },
  weakening: { label: "Weakening", cls: "bg-warn/15 text-warn", hint: "Stronger than the market but losing steam" },
  lagging: { label: "Lagging", cls: "bg-down/15 text-down", hint: "Behind the market and still falling back" },
};
const STANCE = { overweight: "bg-up/15 text-up", neutral: "bg-muted text-muted-foreground", underweight: "bg-down/15 text-down" } as const;

function Rrg({ sectors, selected, onSelect }: { sectors: Outlook[]; selected: string | null; onSelect: (i: string | null) => void }) {
  // Zoom to where most sectors sit (the 90th percentile of their distance from the centre) so the cluster is readable; outliers are held at the edge.
  const ends = sectors.map((s) => s.rrg[s.rrg.length - 1]).filter(Boolean);
  const dev = ends.map((p) => Math.max(Math.abs(p.ratio - 100), Math.abs(p.momentum - 100))).sort((a, b) => a - b);
  const span = Math.max(3, (dev[Math.floor(dev.length * 0.9)] ?? 4) * 1.25);
  const W = 560, H = 480, pad = 34;
  const cl = (v: number) => Math.max(-span, Math.min(span, v - 100));
  const x = (r: number) => pad + ((cl(r) + span) / (2 * span)) * (W - 2 * pad);
  const y = (m: number) => H - pad - ((cl(m) + span) / (2 * span)) * (H - 2 * pad);
  const color = (q: Quadrant) => (q === "leading" ? "var(--up)" : q === "improving" ? "var(--primary)" : q === "weakening" ? "var(--warn)" : "var(--down)");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-xl border bg-card" role="img" aria-label="Relative rotation graph of sectors">
      <rect x={x(100)} y={pad} width={W - pad - x(100)} height={y(100) - pad} fill="var(--up)" opacity={0.07} />
      <rect x={pad} y={pad} width={x(100) - pad} height={y(100) - pad} fill="var(--primary)" opacity={0.07} />
      <rect x={x(100)} y={y(100)} width={W - pad - x(100)} height={H - pad - y(100)} fill="var(--warn)" opacity={0.07} />
      <rect x={pad} y={y(100)} width={x(100) - pad} height={H - pad - y(100)} fill="var(--down)" opacity={0.07} />
      <line x1={x(100)} x2={x(100)} y1={pad} y2={H - pad} stroke="var(--border)" /><line x1={pad} x2={W - pad} y1={y(100)} y2={y(100)} stroke="var(--border)" />
      {([["Improving", pad + 6, pad + 14], ["Leading", W - pad - 52, pad + 14], ["Lagging", pad + 6, H - pad - 8], ["Weakening", W - pad - 70, H - pad - 8]] as const).map(([t, tx, ty]) => <text key={t} x={tx} y={ty} fontSize={11} fill="var(--muted-foreground)">{t}</text>)}
      <text x={W / 2} y={H - 6} fontSize={10} textAnchor="middle" fill="var(--muted-foreground)">Relative strength (100 = on its trend) →</text>
      <text x={10} y={H / 2} fontSize={10} fill="var(--muted-foreground)" transform={`rotate(-90 10 ${H / 2})`} textAnchor="middle">Momentum ↑</text>
      {sectors.map((s) => {
        const on = selected === s.index, dim = selected && !on;
        const tail = s.rrg.slice(-5).map((p) => `${x(p.ratio)},${y(p.momentum)}`).join(" ");
        const end = s.rrg[s.rrg.length - 1];
        return (
          <g key={s.index} opacity={dim ? 0.25 : 1} style={{ cursor: "pointer" }} onClick={() => onSelect(on ? null : s.index)}>
            <polyline points={tail} fill="none" stroke={color(s.quadrant)} strokeWidth={on ? 2 : 1} opacity={0.55} />
            <circle cx={x(end.ratio)} cy={y(end.momentum)} r={on ? 6 : 4.5} fill={color(s.quadrant)} stroke="var(--card)" strokeWidth={1.5} />
            <text x={x(end.ratio) + 7} y={y(end.momentum) + 3} fontSize={on ? 11 : 9.5} fill="var(--foreground)">{s.label}</text>
          </g>
        );
      })}
    </svg>
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
        <div className="rounded-xl border bg-card p-3.5"><div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{b.index} (the market)</div><div className="mt-1 flex flex-wrap gap-x-3 font-mono text-xs">{(["w1", "m1", "m3", "y1"] as const).map((k) => <span key={k}><span className="text-muted-foreground">{k === "w1" ? "1W" : k === "m1" ? "1M" : k === "m3" ? "3M" : "1Y"} </span><b className={b.returns[k] >= 0 ? "text-up" : "text-down"}>{pct(b.returns[k])}</b></span>)}</div></div>
        <div className="rounded-xl border bg-card p-3.5"><div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Market breadth, all NSE stocks</div>{br ? <><div className="mt-1 text-sm"><b className="text-up">{br.advances}</b> up · <b className="text-down">{br.declines}</b> down <span className="text-xs text-muted-foreground">({br.adRatio.toFixed(2)} advance/decline)</span></div><div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-muted"><span className="bg-up" style={{ width: `${(br.advances / br.total) * 100}%` }} /><span className="bg-down" style={{ width: `${(br.declines / br.total) * 100}%` }} /></div></> : <div className="text-sm text-muted-foreground">Unavailable</div>}</div>
        <div className="rounded-xl border bg-card p-3.5"><div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">India VIX (fear gauge)</div>{data.vix ? <div className="mt-1 text-sm"><b className="font-mono text-lg">{data.vix.level.toFixed(1)}</b> <span className={cn("text-xs", (data.vix.change1dPct ?? 0) >= 0 ? "text-down" : "text-up")}>{data.vix.change1dPct !== undefined ? pct(data.vix.change1dPct) : ""} today</span><div className="text-xs text-muted-foreground">{data.vix.level < 14 ? "Calm" : data.vix.level < 20 ? "Normal" : data.vix.level < 25 ? "Nervous" : "Fearful"}</div></div> : <div className="text-sm text-muted-foreground">Unavailable</div>}</div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Sector</th><th className="font-medium">View</th><th className="text-right font-medium">1 week</th><th className="text-right font-medium">1 month</th><th className="text-right font-medium">3 months</th><th className="text-right font-medium">6 months</th><th className="text-right font-medium">1 year</th><th className="px-3 text-right font-medium">P/E</th></tr></thead>
            <tbody className="divide-y">
              {data.sectors.map((s) => (
                <tr key={s.index} onClick={() => setSelected(selected === s.index ? null : s.index)} className={cn("cursor-pointer hover:bg-accent/40", selected === s.index && "bg-accent/50")} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setSelected(selected === s.index ? null : s.index); }}>
                  <td className="px-3 py-2"><div className="font-medium">{s.label}</div><div className="flex items-center gap-1.5 text-[11px]"><span className={cn("rounded px-1.5 py-0.5 font-semibold", QUAD[s.quadrant].cls)} title={QUAD[s.quadrant].hint}>{QUAD[s.quadrant].label}</span><span className="text-muted-foreground">{s.trend === "up" ? "uptrend" : s.trend === "down" ? "downtrend" : "mixed trend"}</span></div></td>
                  <td><span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", STANCE[s.stance])}>{s.stance === "overweight" ? "Favour" : s.stance === "underweight" ? "Avoid" : "Neutral"} · {s.score}</span></td>
                  {(["w1", "m1", "m3", "m6", "y1"] as const).map((k) => <td key={k} className="tabular text-right font-mono"><span className={s.returns[k] >= 0 ? "text-up" : "text-down"}>{pct(s.returns[k])}</span><div className={cn("text-[10px]", s.vsBench[k] >= 0 ? "text-up/80" : "text-down/80")}>{pct(s.vsBench[k])} vs mkt</div></td>)}
                  <td className="tabular px-3 text-right font-mono">{s.pe ? s.pe.toFixed(1) : "—"}<div className={cn("text-[10px]", s.valuation === "rich" ? "text-down" : s.valuation === "cheap" ? "text-up" : "text-muted-foreground")}>{s.valuation ?? ""}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3">
          <Rrg sectors={data.sectors} selected={selected} onSelect={setSelected} />
          <p className="text-xs text-muted-foreground">Relative Rotation Graph: each dot is a sector, with its last 8 weeks as a tail. Money tends to rotate clockwise: <b>Improving → Leading → Weakening → Lagging</b>. Favour sectors in Leading or Improving.</p>
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
