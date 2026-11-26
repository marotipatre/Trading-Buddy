"use client";

import { useEffect, useState } from "react";
import type { SymbolHit } from "@/lib/data/types";

export function SymbolSearch({ onPick, placeholder = "Search NSE symbol (e.g. RELIANCE)" }: {
  onPick: (hit: SymbolHit) => void;
  placeholder?: string;
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
        setHits(json.results ?? []);
      } catch {}
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  return (
    <div className="relative w-72">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />
      {q.trim().length >= 2 && hits.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-line bg-panel shadow-lg">
          {hits.map((h) => (
            <li key={h.symbol}>
              <button
                className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent/20"
                onClick={() => {
                  onPick(h);
                  setQ("");
                  setHits([]);
                }}
              >
                <span className="font-medium">{h.symbol}</span>
                <span className="truncate text-xs text-muted">{h.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
