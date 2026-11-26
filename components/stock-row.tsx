"use client";

import Link from "next/link";
import { Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChangePill } from "@/components/change-pill";
import { SymbolLabel } from "@/components/symbol-label";
import type { Quote } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export function StockRow({ symbol, name, quote, onToggleWatch, watched, onRemove }: {
  symbol: string;
  name?: string | null;
  quote?: Quote;
  watched?: boolean;
  onToggleWatch?: () => void;
  onRemove?: () => void;
}) {
  const href = `/trade?symbol=${encodeURIComponent(symbol)}`;
  return (
    <div className="group flex items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-accent/40">
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
        <SymbolLabel symbol={symbol} name={name} className="min-w-0 flex-1" />
        <div className="text-right">
          <div className="tabular font-mono text-sm font-semibold">{quote ? quote.price.toFixed(2) : <span className="text-muted-foreground">—</span>}</div>
          <ChangePill pct={quote?.changePct} />
        </div>
      </Link>
      <div className="flex w-[7.5rem] items-center justify-end gap-1">
        <div className="hidden items-center gap-1 group-hover:flex">
          <Button size="xs" nativeButton={false} className="bg-up text-background hover:bg-up/85" render={<Link href={`${href}&side=buy`} />}>Buy</Button>
          <Button size="xs" variant="outline" nativeButton={false} className="border-down/50 text-down hover:bg-down/10" render={<Link href={`${href}&side=sell`} />}>Sell</Button>
        </div>
        {onToggleWatch && (
          <Button variant="ghost" size="icon-sm" aria-label={watched ? "Remove from watchlist" : "Add to watchlist"} onClick={onToggleWatch}>
            <Star className={cn(watched && "fill-warn text-warn")} />
          </Button>
        )}
        {onRemove && (
          <Button variant="ghost" size="icon-sm" aria-label="Remove" className="opacity-0 group-hover:opacity-100" onClick={onRemove}><Trash2 /></Button>
        )}
      </div>
    </div>
  );
}
