"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const OPEN = 9 * 60 + 15, CLOSE = 15 * 60 + 30, SPAN = CLOSE - OPEN;
const MARKS = [
  { at: 9 * 60 + 30, label: "Opening range ends 9:30" },
  { at: 14 * 60 + 30, label: "Wind-down from 2:30: no new trades" },
  { at: 15 * 60 + 15, label: "Brokers square off intraday positions about 3:15" },
];

function phase(min: number, weekday: boolean): { text: string; tone: "open" | "wait" | "shut" } {
  if (!weekday) return { text: "Closed for the weekend. Opens Monday 9:15 am", tone: "shut" };
  if (min < 9 * 60) return { text: "Before the market. Pre-open starts 9:00 am", tone: "shut" };
  if (min < OPEN) return { text: "Pre-open auction. Trading starts 9:15 am", tone: "wait" };
  if (min < 9 * 60 + 30) return { text: "Opening range: let the first 15 minutes settle", tone: "wait" };
  if (min < 14 * 60 + 30) return { text: "Main session", tone: "open" };
  if (min < 15 * 60 + 15) return { text: "Wind-down: close what is left, no new trades", tone: "wait" };
  if (min < CLOSE) return { text: "Square-off window. Be flat", tone: "wait" };
  return { text: "Market closed. Last close is shown", tone: "shut" };
}

/**
 * The trading day as a rail: 9:15 to 3:30 India time, the moments the rule books refer to, and a marker for now.
 * Reads the clock through useNow so it is safe under Cache Components; renders a quiet placeholder until mounted.
 */
export function SessionRail({ className }: { className?: string }) {
  // The clock only exists in the browser: read it after mount (never during render) and tick every 20 seconds.
  const [nowSec, setNowSec] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNowSec(Math.floor(Date.now() / 1000));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 20_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  if (nowSec === null) return <div className={cn("h-9", className)} aria-hidden />;
  const ist = new Date((nowSec + 19800) * 1000);
  const min = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const day = ist.getUTCDay();
  const weekday = day >= 1 && day <= 5;
  const p = phase(min, weekday);
  const pct = !weekday ? 0 : Math.min(100, Math.max(0, ((min - OPEN) / SPAN) * 100));
  const live = weekday && min >= OPEN && min < CLOSE;
  const time = `${String(ist.getUTCHours() % 12 || 12)}:${String(ist.getUTCMinutes()).padStart(2, "0")} ${ist.getUTCHours() >= 12 ? "pm" : "am"}`;
  return (
    <div className={cn("min-w-0", className)} role="status" aria-live="off">
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 font-medium">
          <span className={cn("size-1.5 shrink-0 rounded-full", p.tone === "open" ? "bg-up" : p.tone === "wait" ? "bg-warn" : "bg-muted-foreground/50")} />
          <span className="truncate">{p.text}</span>
        </span>
        <span className="figure shrink-0 text-muted-foreground">{time} IST</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-muted">
        <div className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-700", live ? "bg-primary" : "bg-muted-foreground/30")} style={{ width: `${pct}%` }} />
        {MARKS.map((m) => (
          <span key={m.at} title={m.label} className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-foreground/25" style={{ left: `${((m.at - OPEN) / SPAN) * 100}%` }} />
        ))}
        {live && <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow" style={{ left: `${pct}%` }} />}
      </div>
    </div>
  );
}
