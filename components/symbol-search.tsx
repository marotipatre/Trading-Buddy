"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Search, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SymbolLabel } from "@/components/symbol-label";
import type { SymbolHit } from "@/lib/data/types";
import { loadRecent } from "@/lib/recent-symbols";
import { companyName, rememberName, tidyName } from "@/lib/symbols";
import { POPULAR_STOCKS } from "@/lib/universe";
import { cn } from "@/lib/utils";

/**
 * Search across every NSE and BSE stock and index. Results come from a local index on the server,
 * so it is instant. Focus with an empty box shows your recent symbols and popular stocks.
 * Arrow keys move, Enter picks, Escape closes.
 */
export function SymbolSearch({ onPick, placeholder = "Search any stock or index", className = "w-72" }: {
  onPick: (hit: SymbolHit) => void;
  placeholder?: string;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SymbolHit[]>([]);
  const [settled, setSettled] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const term = q.trim();

  useEffect(() => {
    if (!term) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/symbols?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "search failed");
        const results: SymbolHit[] = json.results ?? [];
        results.forEach((r) => rememberName(r.symbol, tidyName(r.name)));
        setHits(results);
        setFailed(false);
        setActive(0);
        setSettled(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") { setFailed(true); setSettled(true); }
      }
    }, 120);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [term]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // With nothing typed, offer where you have been and what is popular.
  const suggestions = useMemo<SymbolHit[]>(() => {
    const seen = new Set<string>();
    const out: SymbolHit[] = [];
    for (const s of [...recent, ...POPULAR_STOCKS.slice(0, 8).map((p) => p.symbol)]) {
      if (seen.has(s)) continue;
      seen.add(s);
      out.push({ symbol: s, name: companyName(s) ?? s, exchange: s.endsWith(".BO") ? "BSE" : s.startsWith("^") ? "INDEX" : "NSE" });
    }
    return out.slice(0, 10);
  }, [recent]);

  const list = term ? hits : suggestions;
  const pick = (h: SymbolHit) => {
    onPick(h);
    setQ("");
    setHits([]);
    setSettled(false);
    setOpen(false);
  };

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, Math.max(0, list.length - 1))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && list[active]) { e.preventDefault(); pick(list[active]); }
    else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={box} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
      <Input
        value={q}
        placeholder={placeholder}
        className="pl-8"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open}
        aria-controls="symbol-search-list"
        onChange={(e) => { setQ(e.target.value); setOpen(true); setSettled(false); setActive(0); }}
        onFocus={() => { setRecent(loadRecent()); setOpen(true); }}
        onKeyDown={onKey}
      />
      {open && (
        <div id="symbol-search-list" role="listbox" className="absolute z-30 mt-1 max-h-96 w-full min-w-72 overflow-auto rounded-lg border bg-popover p-1 shadow-xl">
          {!term && (
            <div className="flex items-center gap-1.5 px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {recent.length ? <><Clock className="size-3" /> Recent &amp; popular</> : <><TrendingUp className="size-3" /> Popular</>}
            </div>
          )}
          {list.map((h, i) => (
            <button
              key={h.symbol}
              type="button"
              role="option"
              aria-selected={i === active}
              className={cn("flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm", i === active ? "bg-accent" : "hover:bg-accent/60")}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(h)}
            >
              <SymbolLabel symbol={h.symbol} name={h.name ? tidyName(h.name) : undefined} />
            </button>
          ))}
          {term && settled && list.length === 0 && (
            <p className="px-3 py-4 text-sm text-muted-foreground">{failed ? "Search is unavailable right now. Try again in a moment." : `No stock or index matches "${term}".`}</p>
          )}
          {term && !settled && list.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">Searching…</p>}
        </div>
      )}
    </div>
  );
}
