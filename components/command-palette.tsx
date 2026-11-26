"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { SymbolLabel } from "@/components/symbol-label";
import type { SymbolHit } from "@/lib/data/types";
import { tidyName } from "@/lib/symbols";
import { cn } from "@/lib/utils";

const PAGES = [
  { label: "Explore", href: "/dashboard", hint: "Markets, watchlist, movers" },
  { label: "Stocks", href: "/stocks", hint: "By size class and sector" },
  { label: "Ideas", href: "/ideas", hint: "Swing ideas, sectors, what to expect" },
  { label: "Intraday", href: "/intraday", hint: "Next-session picks and the 5x pot" },
  { label: "Portfolio", href: "/portfolio", hint: "Holdings, positions, orders" },
  { label: "My portfolio review", href: "/portfolio?tab=review", hint: "Hold, add, trim or exit" },
  { label: "Funds", href: "/portfolio?tab=funds", hint: "Trading and bank pots" },
  { label: "Price alerts", href: "/portfolio?tab=alerts", hint: "Alerts you set" },
  { label: "Backtest", href: "/strategies", hint: "Test a strategy on history" },
  { label: "Swing rule book", href: "/playbook?book=swing", hint: "Rules for holding days to weeks" },
  { label: "Intraday rule book", href: "/playbook?book=intraday", hint: "Rules for same-day trades" },
];

/** Press Ctrl+K (or Cmd+K, or /) anywhere to jump to a page or a stock. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SymbolHit[]>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT" || e.target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setOpen(true); }
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (open) { /* eslint-disable react-hooks/set-state-in-effect -- reset the box each time it opens */ setQ(""); setHits([]); setActive(0); /* eslint-enable react-hooks/set-state-in-effect */ setTimeout(() => input.current?.focus(), 0); }
  }, [open]);

  const term = q.trim();
  const pages = useMemo(() => PAGES.filter((p) => !term || `${p.label} ${p.hint}`.toLowerCase().includes(term.toLowerCase())).slice(0, 6), [term]);
  useEffect(() => {
    if (!open || term.length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const j = await (await fetch(`/api/symbols?q=${encodeURIComponent(term)}`, { signal: ctl.signal })).json();
        setHits(((j.results ?? []) as SymbolHit[]).slice(0, 6));
      } catch { /* ignore */ }
    }, 120);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [term, open]);

  type Item = { key: string; go: () => void; node: React.ReactNode };
  const go = useCallback((href: string) => { setOpen(false); router.push(href); }, [router]);
  const shownHits = term.length >= 2 ? hits : [];
  const items: Item[] = [
    ...pages.map((p) => ({ key: p.href, go: () => go(p.href), node: <><span className="text-sm font-medium">{p.label}</span><span className="ml-2 text-xs text-muted-foreground">{p.hint}</span></> })),
    ...shownHits.map((h) => ({ key: h.symbol, go: () => go(`/trade?symbol=${encodeURIComponent(h.symbol)}`), node: <SymbolLabel symbol={h.symbol} name={h.name ? tidyName(h.name) : undefined} /> })),
  ];
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-items-center bg-background/60 px-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)} role="presentation">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border bg-popover shadow-2xl" role="dialog" aria-label="Quick navigation" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="size-4 text-muted-foreground" />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} placeholder="Go to a page or search any stock…" aria-label="Search"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); items[active]?.go(); }
            }} />
          <kbd className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing matches &ldquo;{q}&rdquo;.</li>}
          {items.map((it, i) => (
            <li key={it.key} role="option" aria-selected={i === active}>
              <button type="button" onMouseEnter={() => setActive(i)} onClick={it.go} className={cn("flex w-full items-center rounded-lg px-3 py-2 text-left", i === active ? "bg-accent" : "hover:bg-accent/60")}>
                {it.node}{i === active && <CornerDownLeft className="ml-auto size-3.5 text-muted-foreground" />}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-4 border-t px-4 py-2 text-[11px] text-muted-foreground"><span>↑↓ move</span><span>↵ open</span><span>Ctrl K or / anywhere</span></div>
      </div>
    </div>
  );
}
