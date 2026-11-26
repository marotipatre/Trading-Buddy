"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { isMarketOpen, istParts } from "@/lib/market-hours";

export function MarketStatus() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only clock avoids hydration mismatch
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return <div className="h-6" />;
  const open = isMarketOpen(now);
  return (
    <div className="flex items-center justify-between gap-2">
      <Badge variant="outline" className="gap-1.5">
        <span className={`size-1.5 rounded-full ${open ? "bg-up" : "bg-down"}`} />
        NSE {open ? "open" : "closed"}
      </Badge>
      <span className="font-mono text-xs text-muted-foreground">{istParts(now).text} IST</span>
    </div>
  );
}
