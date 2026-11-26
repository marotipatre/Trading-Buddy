import { fmtPct } from "@/lib/format";
import type { MonteCarloResult } from "@/lib/engine/montecarlo";

/** Fan of simulated outcomes: 5th-95th range, interquartile box and the median. */
export function McRange({ mc }: { mc: MonteCarloResult }) {
  const { p5, p25, p50, p75, p95 } = mc.returnPct;
  const lo = Math.min(p5, 0);
  const hi = Math.max(p95, 0);
  const span = hi - lo || 1;
  const pos = (v: number) => `${((v - lo) / span) * 100}%`;
  return (
    <div className="space-y-2" role="img"
      aria-label={`Simulated return: 5th percentile ${fmtPct(p5)}, median ${fmtPct(p50)}, 95th percentile ${fmtPct(p95)}`}>
      <div className="relative h-10">
        <div className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded bg-muted-foreground/40" style={{ left: pos(p5), width: `calc(${pos(p95)} - ${pos(p5)})` }} />
        <div className="absolute top-1/2 h-5 -translate-y-1/2 rounded-md bg-series-1/70" style={{ left: pos(p25), width: `calc(${pos(p75)} - ${pos(p25)})` }} />
        <div className="absolute top-1/2 h-8 w-0.5 -translate-y-1/2 bg-foreground" style={{ left: pos(p50) }} />
        <div className="absolute inset-y-0 w-px bg-border" style={{ left: pos(0) }} title="Break-even" />
      </div>
      <div className="flex justify-between font-mono text-xs text-muted-foreground">
        <span>5%: {fmtPct(p5, 0, { sign: true })}</span>
        <span>Median: {fmtPct(p50, 0, { sign: true })}</span>
        <span>95%: {fmtPct(p95, 0, { sign: true })}</span>
      </div>
    </div>
  );
}
