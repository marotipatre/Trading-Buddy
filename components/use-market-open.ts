"use client";

import { useEffect, useState } from "react";
import { isMarketOpen } from "@/lib/market-hours";

/**
 * Whether the NSE session is open. `null` until mounted: reading the clock during render is
 * unstable under Cache Components and would also differ between server and browser.
 */
export function useMarketOpen(): boolean | null {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const tick = () => setOpen(isMarketOpen());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return open;
}
