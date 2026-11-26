import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

/** +1.62% with an arrow, coloured like a broker app. */
export function ChangePill({ pct, amount, className }: { pct?: number; amount?: number; className?: string }) {
  if (pct === undefined || !Number.isFinite(pct)) return <span className={cn("text-sm text-muted-foreground", className)}>—</span>;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("tabular inline-flex items-center gap-0.5 font-mono text-sm font-medium", up ? "text-up" : "text-down", className)}>
      <Icon className="size-3.5" />
      {amount !== undefined && <span>{up ? "+" : ""}{amount.toFixed(2)}</span>}
      <span>{amount !== undefined ? `(${fmtPct(pct, 2)})` : fmtPct(pct, 2, { sign: true })}</span>
    </span>
  );
}
