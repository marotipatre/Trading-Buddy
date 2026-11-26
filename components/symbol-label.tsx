import { companyName, displaySymbol, exchangeOf } from "@/lib/symbols";
import { cn } from "@/lib/utils";

/** How broker apps label an instrument: bold ticker, small exchange tag, company name underneath. */
export function SymbolLabel({ symbol, name, className, compact = false }: {
  symbol: string;
  name?: string | null;
  className?: string;
  /** Single line: ticker and exchange only. */
  compact?: boolean;
}) {
  const ex = exchangeOf(symbol);
  const full = name ?? companyName(symbol);
  return (
    <div className={cn("min-w-0 leading-tight", className)}>
      <div className="flex items-center gap-1.5">
        <span className="truncate font-semibold tracking-tight">{displaySymbol(symbol)}</span>
        {ex !== "INDEX" && <span className="rounded bg-muted px-1 py-px text-[10px] font-medium text-muted-foreground">{ex}</span>}
      </div>
      {!compact && full && <div className="truncate text-xs text-muted-foreground">{full}</div>}
    </div>
  );
}
