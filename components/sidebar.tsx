"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, CandlestickChart, FlaskConical, Wallet, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MarketStatus } from "./market-status";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ready: true },
  { href: "/trade", label: "Chart & Trade", icon: CandlestickChart, ready: true },
  { href: "/strategies", label: "Strategies", icon: FlaskConical, ready: false },
  { href: "/portfolio", label: "Portfolio", icon: Wallet, ready: false },
];

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-panel p-4">
      <div className="mb-6 text-lg font-semibold">PaperDesk</div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon, ready }) =>
          ready ? (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                path.startsWith(href) ? "bg-accent/20 text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              <Icon size={16} /> {label}
            </Link>
          ) : (
            <span key={href} className="flex items-center gap-2 px-3 py-2 text-sm text-muted/50" title="Coming in a later phase">
              <Icon size={16} /> {label}
            </span>
          ),
        )}
      </nav>
      <MarketStatus />
      <button
        onClick={async () => {
          await createClient().auth.signOut();
          router.replace("/login");
        }}
        className="mt-3 flex items-center gap-2 text-xs text-muted hover:text-foreground"
      >
        <LogOut size={14} /> Sign out
      </button>
    </aside>
  );
}
