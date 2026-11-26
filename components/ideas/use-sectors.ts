"use client";

import { useEffect, useState } from "react";
import type { SectorsPayload } from "@/lib/sectors/load";

const KEY = "tb.sectors.v1";
let memo: { at: number; body: SectorsPayload } | null = null;

/** NSE sector outlook (official end-of-day index data). Shows the saved copy at once and refreshes it in the background. */
export function useSectors() {
  const [data, setData] = useState<SectorsPayload | null>(memo?.body ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!memo);
  useEffect(() => {
    let live = true;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as typeof memo;
      /* eslint-disable react-hooks/set-state-in-effect -- show the saved copy right after mount */
      if (saved?.body && !memo) { memo = saved; setData(saved.body); setLoading(false); }
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch { /* ignore */ }
    if (memo && Date.now() - memo.at < 30 * 60_000) return;
    fetch("/api/sectors").then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "failed");
      memo = { at: Date.now(), body: j };
      try { localStorage.setItem(KEY, JSON.stringify(memo)); } catch { /* storage full */ }
      if (live) { setData(j); setError(null); }
    }).catch((e: Error) => { if (live && !memo) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  return { data, error, loading };
}
