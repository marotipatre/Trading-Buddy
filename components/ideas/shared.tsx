import type { Idea } from "@/lib/analysis/ideas-engine";
import { cn } from "@/lib/utils";

export const pct = (n: number, d = 1) => (Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(d)}%` : "—");
export const ARROW = { up: "▲", down: "▼", flat: "▬" } as const;
export const TONE = { up: "text-up", down: "text-down", flat: "text-muted-foreground" } as const;
export const VERDICT_LABEL = { buy: "Buy setup", watch: "Watch", avoid: "Avoid" } as const;
export const VERDICT_BG = { buy: "bg-up/15 text-up", watch: "bg-warn/15 text-warn", avoid: "bg-down/15 text-down" } as const;
export const CAP_SHORT = { large: "Large", mid: "Mid", small: "Small", micro: "Micro" } as const;

/** A small ring showing a 0-100 score, coloured by the verdict. */
export function ScoreRing({ score, verdict, size = 44 }: { score: number; verdict: Idea["v"]["verdict"]; size?: number }) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  const color = verdict === "buy" ? "var(--up)" : verdict === "watch" ? "var(--warn)" : "var(--down)";
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`Score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <span className="tabular absolute font-mono text-xs font-semibold">{score}</span>
    </span>
  );
}

/** Where the stop, entry and target sit, to scale, with the current price marked. */
export function PlanMeter({ stop, entry, target, price }: { stop: number; entry: number; target: number; price: number }) {
  const lo = Math.min(stop, price) * 0.998, hi = Math.max(target, price) * 1.002;
  const at = (x: number) => `${Math.min(100, Math.max(0, ((x - lo) / (hi - lo)) * 100))}%`;
  return (
    <div className="space-y-1" role="img" aria-label={`Stop ${stop.toFixed(2)}, entry ${entry.toFixed(2)}, target ${target.toFixed(2)}`}>
      <div className="relative h-2 rounded-full bg-muted">
        <span className="absolute inset-y-0 rounded-l-full bg-down/40" style={{ left: at(stop), width: `calc(${at(entry)} - ${at(stop)})` }} />
        <span className="absolute inset-y-0 rounded-r-full bg-up/40" style={{ left: at(entry), width: `calc(${at(target)} - ${at(entry)})` }} />
        <span className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-foreground" style={{ left: at(entry) }} title="Entry" />
        <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary" style={{ left: at(price) }} title="Price now" />
      </div>
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground"><span className="text-down">{stop.toFixed(2)}</span><span>{entry.toFixed(2)}</span><span className="text-up">{target.toFixed(2)}</span></div>
    </div>
  );
}

export function Conviction({ level }: { level: Idea["conviction"] }) {
  const n = level === "high" ? 3 : level === "medium" ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-0.5" title={`${level} conviction: how many independent signals agree`} aria-label={`${level} conviction`}>
      {[1, 2, 3].map((i) => <span key={i} className={cn("h-1.5 w-3 rounded-full", i <= n ? (level === "low" ? "bg-warn" : "bg-up") : "bg-muted")} />)}
    </span>
  );
}

export function Trend({ frames }: { frames: Idea["v"]["frames"] }) {
  return (
    <span className="font-mono text-xs" title="Daily, weekly and monthly trend">
      {(["daily", "weekly", "monthly"] as const).map((f) => <span key={f} className={cn("mr-1.5", TONE[frames[f]])}>{f[0].toUpperCase()}{ARROW[frames[f]]}</span>)}
    </span>
  );
}
