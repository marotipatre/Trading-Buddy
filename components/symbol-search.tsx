"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { SymbolHit } from "@/lib/data/types";
import { SymbolLabel } from "@/components/symbol-label";
import { rememberName, tidyName } from "@/lib/symbols";

export function SymbolSearch({ onPick, placeholder = "Search stocks, e.g. RELIANCE", className = "w-72" }: {
  onPick: (hit: SymbolHit) => void;
  placeholder?: string;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SymbolHit[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/symbols?q=${encodeURIComponent(q)}`, { signal: ctl.signal });
        const json = await res.json();
        const results: SymbolHit[] = json.results ?? [];
        results.forEach((r) => rememberName(r.symbol, tidyName(r.name)));
        setHits(results);
      } catch {}
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-8" />
      {q.trim().length >= 2 && hits.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-xl">
          {hits.map((h) => (
            <li key={h.symbol}>
              <button
                className="flex w-full flex-col rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onPick(h);
                  setQ("");
                  setHits([]);
                }}
              >
                <SymbolLabel symbol={h.symbol} name={tidyName(h.name)} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
