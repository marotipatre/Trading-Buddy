"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, BookOpen, ChevronDown, CircleHelp, FlaskConical, LogOut, TrendingUp, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useAlerts } from "@/components/alerts/alerts-provider";
import { useMarketOpen } from "@/components/use-market-open";
import { usePaper } from "@/components/paper/paper-provider";
import { SymbolSearch } from "@/components/symbol-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { fmtInr } from "@/lib/format";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/dashboard", label: "Explore" },
  { href: "/stocks", label: "Stocks" },
  { href: "/ideas", label: "Ideas" },
  { href: "/multibagger", label: "Multibagger" },
  { href: "/intraday", label: "Intraday" },
  { href: "/portfolio", label: "Portfolio" },
] as const;
const MORE = [
  { href: "/strategies", label: "Backtest", hint: "Test a strategy on history", icon: FlaskConical },
  { href: "/playbook", label: "Rule books", hint: "Swing and intraday rules", icon: BookOpen },
  { href: "/help", label: "Help", hint: "Data sources, extras, FAQ", icon: CircleHelp },
] as const;

const isActive = (path: string, href: string) => path.startsWith(href) || (href === "/dashboard" && path.startsWith("/trade"));

function MoreMenu({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the menu after navigating
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const inMore = MORE.some((m) => isActive(path, m.href));
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className={cn("flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", inMore ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>
        More <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border bg-popover p-1.5 shadow-xl">
          {MORE.map(({ href, label, hint, icon: Icon }) => (
            <Link key={href} href={href} role="menuitem" className={cn("flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-accent", isActive(path, href) && "bg-accent")}>
              <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="size-4" /></span>
              <span><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppHeader() {
  const path = usePathname();
  const router = useRouter();
  const { equity, ready } = usePaper();
  const { alerts } = useAlerts();
  const marketOpen = useMarketOpen();
  const activeAlerts = alerts.filter((a) => a.status === "active").length;
  const open = (symbol: string) => router.push(`/trade?symbol=${encodeURIComponent(symbol)}`);
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 lg:px-8">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><TrendingUp size={16} /></span>
          <span className="hidden text-base font-semibold tracking-tight xl:block">Trading Buddy</span>
        </Link>
        <nav className="hidden shrink-0 items-center gap-0.5 md:flex" aria-label="Primary">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isActive(path, n.href) ? "page" : undefined}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", isActive(path, n.href) ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>
              {n.label}
            </Link>
          ))}
          <MoreMenu path={path} />
        </nav>
        <div className="hidden min-w-0 flex-1 justify-end md:flex">
          <SymbolSearch onPick={(h) => open(h.symbol)} className="w-full max-w-xs" />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
          <span className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground lg:flex" title={marketOpen ? "NSE is open" : "NSE is closed"}>
            <span className={cn("size-1.5 rounded-full", marketOpen === null ? "bg-muted-foreground/40" : marketOpen ? "bg-up" : "bg-down")} />
            {marketOpen === null ? "NSE" : marketOpen ? "Market open" : "Market closed"}
          </span>
          <Link href="/portfolio?tab=funds" className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm hover:bg-accent" title="Trading balance">
            <Wallet className="size-4 text-primary" />
            <span className="tabular font-mono font-medium">{ready ? fmtInr(equity) : "—"}</span>
          </Link>
          <Link href="/portfolio?tab=alerts" aria-label={`Price alerts (${activeAlerts} active)`} className="relative grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
            <Bell className="size-4" />
            {activeAlerts > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">{activeAlerts}</span>}
          </Link>
          <ThemeToggle />
          <Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out"
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
