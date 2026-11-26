"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, CandlestickChart, FlaskConical, Wallet, LogOut, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { MarketStatus } from "./market-status";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ready: true },
  { href: "/trade", label: "Chart", icon: CandlestickChart, ready: true },
  { href: "/strategies", label: "Backtest", icon: FlaskConical, ready: true },
  { href: "/portfolio", label: "Portfolio", icon: Wallet, ready: true },
];

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <TrendingUp size={16} />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Trading Buddy</div>
          <div className="text-[11px] text-muted-foreground">Paper trade &amp; backtest</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon, ready }) =>
          ready ? (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                path.startsWith(href)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon size={16} /> {label}
            </Link>
          ) : (
            <span
              key={href}
              className="flex cursor-not-allowed items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground/40"
              title="Coming soon"
            >
              <Icon size={16} /> {label}
            </span>
          ),
        )}
      </nav>
      <Separator className="my-3" />
      <MarketStatus />
      <Button
        variant="ghost"
        size="sm"
        className="mt-3 justify-start text-muted-foreground"
        onClick={async () => {
          await createClient().auth.signOut();
          router.replace("/login");
        }}
      >
        <LogOut /> Sign out
      </Button>
    </aside>
  );
}
