"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, TrendingUp } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { SPRING } from "@/components/motion/primitives";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { isActive, NAV_GROUPS } from "./nav";

/** Left rail for desktop: grouped navigation, with the account controls at the bottom. */
export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar lg:flex" aria-label="Primary">
      <Link href="/dashboard" className="flex h-16 items-center gap-2.5 px-5">
        <span className="grid size-8 place-items-center rounded-[10px] bg-primary text-primary-foreground"><TrendingUp size={17} strokeWidth={2.4} /></span>
        <span className="font-heading text-[17px] font-semibold tracking-tight">Trading Buddy</span>
      </Link>
      <LayoutGroup id="sidebar">
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
          {NAV_GROUPS.map((g) => (
            <div key={g.title} className="tone" style={{ "--h": g.hue } as React.CSSProperties}>
              <div className="flex items-center gap-1.5 px-2.5 pb-1.5 text-xs font-medium text-muted-foreground"><span className="size-1.5 rounded-full bg-[var(--tone)]" />{g.title}</div>
              <ul className="space-y-0.5">
                {g.items.map(({ href, label, icon: Icon }) => {
                  const on = isActive(path, href);
                  return (
                    <li key={href} className="relative">
                      {on && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-[10px] bg-[var(--tone-soft)]" transition={SPRING} />}
                      <Link href={href} aria-current={on ? "page" : undefined}
                        className={cn("relative flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-sm font-medium transition-colors", on ? "text-[var(--tone-ink)]" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                        <Icon className={cn("size-[18px] shrink-0 transition-colors", on && "text-[var(--tone)]")} strokeWidth={on ? 2.3 : 1.9} />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </LayoutGroup>
      <div className="border-t p-3">
        <p className="px-2 pb-2 text-xs leading-snug text-muted-foreground">Paper money only. For learning, not advice.</p>
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <button type="button" onClick={async () => { await createClient().auth.signOut(); router.replace("/login"); }} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <LogOut className="size-4" />Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
