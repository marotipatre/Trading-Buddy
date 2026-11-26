"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, FlaskConical, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Explore", icon: Compass },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/strategies", label: "Backtest", icon: FlaskConical },
];

/** Bottom tab bar for phones, like retail broker apps. */
export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = path.startsWith(href) || (href === "/dashboard" && path.startsWith("/trade"));
        return (
          <Link key={href} href={href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
