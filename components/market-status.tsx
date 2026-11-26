"use client";

import { useEffect, useState } from "react";
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
    <div className="flex items-center gap-2 text-xs">
      <span className={`h-2 w-2 rounded-full ${open ? "bg-up" : "bg-down"}`} />
      <span className="text-muted">NSE {open ? "open" : "closed"}</span>
      <span className="font-mono text-muted">{istParts(now).text} IST</span>
    </div>
  );
}
