"use client";

import { useEffect, useState } from "react";
import { rememberName } from "@/lib/symbols";
import type { UniverseStock } from "@/lib/universe-lists";

interface Loaded { stocks: UniverseStock[]; sectors: { name: string; count: number }[] }
const KEY = "trading-buddy:universe:v5";
let memory: Loaded | null = null;

function fromStorage(): Loaded | null {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Loaded) : null;
    return v?.stocks?.length ? v : null;
  } catch {
    return null;
  }
}

/** Stock lists with class and sector. Shows the saved copy at once, then refreshes it quietly. */
export function useUniverse() {
  const [data, setData] = useState<Loaded | null>(memory);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!memory) {
      const saved = fromStorage();
      if (saved) {
        memory = saved;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- show the saved list immediately
        setData(saved);
      }
    }
    fetch("/api/universe?v=7")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Could not load stocks");
        if (!alive) return;
        const next: Loaded = { stocks: j.stocks, sectors: j.sectors };
        next.stocks.forEach((s) => rememberName(s.symbol, s.name));
        memory = next;
        setData(next);
        setError(null);
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      })
      .catch((e: Error) => { if (alive && !memory) setError(e.message); });
    return () => { alive = false; };
  }, []);

  return { ...data, loading: !data && !error, error };
}
