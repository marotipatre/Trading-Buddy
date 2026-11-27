"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, TrendingUp, Wallet } from "lucide-react";
import { useAlerts } from "@/components/alerts/alerts-provider";
import { usePaper } from "@/components/paper/paper-provider";
import { SessionRail } from "@/components/shell/session-rail";
import { SymbolSearch } from "@/components/symbol-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { fmtInr } from "@/lib/format";

/** Top bar: search, the trading-day rail, balance and alerts. Navigation lives in the sidebar (desktop) and bottom bar (phones, tablets). */
export function AppHeader() {
  const router = useRouter();
  const { available, equity, blocked, ready } = usePaper();
  const { alerts } = useAlerts();
  const activeAlerts = alerts.filter((a) => a.status === "active").length;
  const open = (symbol: string) => router.push(`/trade?symbol=${encodeURIComponent(symbol)}`);
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-16 items-center gap-4 px-4 lg:px-8">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2 lg:hidden" aria-label="Trading Buddy home">
          <span className="grid size-8 place-items-center rounded-[10px] bg-primary text-primary-foreground"><TrendingUp size={16} strokeWidth={2.4} /></span>
        </Link>
        <div className="hidden w-full max-w-sm md:block"><SymbolSearch placeholder="Search any NSE stock" onPick={(h) => open(h.symbol)} className="w-full" /></div>
        <SessionRail className="hidden min-w-0 flex-1 lg:block xl:max-w-xl xl:flex-none xl:basis-[34rem] xl:mx-auto" />
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Link href="/portfolio?tab=funds" className="flex items-center gap-2 rounded-[10px] border bg-card px-3 py-1.5 hover:bg-accent" title={`Available to trade${blocked > 0 ? " (some is held by open orders)" : ""}. Account value ${fmtInr(equity)}.`}>
            <Wallet className="size-4 text-primary" />
            <span className="figure text-sm">{ready ? fmtInr(available) : "-"}</span>
          </Link>
          <Link href="/portfolio?tab=alerts" aria-label={`Price alerts (${activeAlerts} active)`} className="relative grid size-9 place-items-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground">
            <Bell className="size-[18px]" />
            {activeAlerts > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">{activeAlerts}</span>}
          </Link>
          <span className="lg:hidden"><ThemeToggle /></span>
        </div>
      </div>
      <div className="px-4 pb-2.5 md:hidden"><SymbolSearch placeholder="Search any NSE stock" onPick={(h) => open(h.symbol)} className="w-full" /></div>
    </header>
  );
}
