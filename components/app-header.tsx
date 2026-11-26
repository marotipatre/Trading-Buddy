"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, TrendingUp, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MarketStatus } from "@/components/market-status";
import { usePaper } from "@/components/paper/paper-provider";
import { SymbolSearch } from "@/components/symbol-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { fmtInr } from "@/lib/format";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/dashboard", label: "Explore" },
  { href: "/stocks", label: "Stocks" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/strategies", label: "Backtest" },
] as const;

export function AppHeader() {
  const path = usePathname();
  const router = useRouter();
  const { equity, ready } = usePaper();
  const open = (symbol: string) => router.push(`/trade?symbol=${encodeURIComponent(symbol)}`);
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 lg:gap-6 lg:px-8">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><TrendingUp size={16} /></span>
          <span className="hidden text-base font-semibold tracking-tight sm:block">Trading Buddy</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                path.startsWith(n.href) || (n.href === "/dashboard" && path.startsWith("/trade")) ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <SymbolSearch onPick={(h) => open(h.symbol)} className="w-full max-w-md" />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden lg:block"><MarketStatus /></div>
          <Link href="/portfolio?tab=funds" className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm hover:bg-accent" title="Trading balance">
            <Wallet className="size-4 text-primary" />
            <span className="tabular font-mono font-medium">{ready ? fmtInr(equity) : "—"}</span>
          </Link>
          <ThemeToggle />
          <Button variant="ghost" size="icon" aria-label="Sign out"
            onClick={async () => { await createClient().auth.signOut(); router.replace("/login"); }}>
            <LogOut />
          </Button>
        </div>
      </div>
      <div className="border-t px-4 py-2 md:hidden">
        <SymbolSearch onPick={(h) => open(h.symbol)} className="w-full" />
      </div>
    </header>
  );
}
