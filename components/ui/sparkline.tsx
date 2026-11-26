import { cn } from "@/lib/utils";

/** A tiny trend line from a list of closes. Green if it ended higher than it started, red if lower. */
export function Sparkline({ values, className, up }: { values: number[]; className?: string; up?: boolean }) {
  if (values.length < 2) return <div className={cn("h-10 w-28", className)} />;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const W = 112, H = 40, pad = 3;
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (W - 2 * pad), pad + (1 - (v - min) / span) * (H - 2 * pad)] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const rising = up ?? values[values.length - 1] >= values[0];
  const color = rising ? "var(--up)" : "var(--down)";
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("h-10 w-28", className)} aria-hidden>
      <polygon points={`${pad},${H} ${line} ${W - pad},${H}`} fill={color} opacity={0.1} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.4} fill={color} />
    </svg>
  );
}
