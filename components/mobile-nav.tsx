"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CircleHelp, Compass, FlaskConical, Layers, Lightbulb, MoreHorizontal, Wallet, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const MAIN = [
  { href: "/dashboard", label: "Explore", icon: Compass },
  { href: "/stocks", label: "Stocks", icon: Layers },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/intraday", label: "Intraday", icon: Zap },
];
const MORE = [
  { href: "/portfolio", label: "Portfolio", icon: Wallet, hint: "Holdings, orders, funds, review" },
  { href: "/strategies", label: "Backtest", icon: FlaskConical, hint: "Test a strategy on history" },
  { href: "/playbook", label: "Rule books", icon: BookOpen, hint: "Swing and intraday rules" },
  { href: "/help", label: "Help", icon: CircleHelp, hint: "Data sources, extras, FAQ" },
];

/** Bottom tab bar for phones, like retail broker apps: four main tabs and a More sheet. */
export function MobileNav() {
  const path = usePathname();
  const [more, setMore] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the sheet after navigating
  useEffect(() => { setMore(false); }, [path]);
  const inMore = MORE.some((m) => path.startsWith(m.href));
  return (
    <>
      {more && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
          <div className="absolute inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] space-y-1 rounded-2xl border bg-popover p-2 shadow-2xl" role="menu" onClick={(e) => e.stopPropagation()}>
            {MORE.map(({ href, label, icon: Icon, hint }) => (
              <Link key={href} href={href} role="menuitem" className={cn("flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-accent", path.startsWith(href) && "bg-accent")}>
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
                <span><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
              </Link>
            ))}
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main">
        {MAIN.map(({ href, label, icon: Icon }) => {
          const active = path.startsWith(href) || (href === "/dashboard" && path.startsWith("/trade"));
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
        <button type="button" aria-expanded={more} aria-label="More" onClick={() => setMore((m) => !m)} className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium", more || inMore ? "text-primary" : "text-muted-foreground")}>
          <MoreHorizontal className="size-5" />
          More
        </button>
      </nav>
    </>
  );
}
