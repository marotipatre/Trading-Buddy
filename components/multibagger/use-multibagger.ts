"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUniverse } from "@/components/use-universe";
import { fetchCandles, pool, prefetchDaily } from "@/lib/analysis/candle-cache";
import { scoreFundamentals, type FaScore, type Fundamentals } from "@/lib/multibagger/fa";
import { parseMarket, type MarketRow } from "@/lib/multibagger/market";
import { diversify, stage1, type Bucket } from "@/lib/multibagger/screen";
import { analyseTa, combine, type Call, type Ta } from "@/lib/multibagger/ta";

export interface Candidate {
  symbol: string; name: string; sector: string; bucket: Bucket; row: MarketRow; why: string[];
  ta: Ta; fa: Fundamentals | null; faScore: FaScore | null; faState: "pending" | "ok" | "none";
  score: number | null; call: Call;
}
export interface MbProgress { phase: "market" | "charts" | "fundamentals" | "done"; done: number; total: number; screened: number }
interface Saved { at: number; screened: number; total: number; items: Candidate[] }
const KEY = "tb.multibagger.v2";
const STALE_MS = 6 * 3600_000;
const nameOf = (s: string) => s;

const read = (): Saved | null => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null; return v?.items?.length ? v : null; } catch { return null; } };
const TIER: Record<Call, number> = { strong: 3, watch: 2, avoid: 1, pending: 0 };
const rank = (a: Candidate, b: Candidate) => TIER[b.call] - TIER[a.call] || (b.score ?? -1) - (a.score ?? -1) || b.ta.score - a.ta.score;

/**
 * Whole-market hunt for small, micro and penny stocks. Stage 1 reads every listed stock from NSE and keeps the tradable
 * ones showing early strength; stage 2 draws the charts of the best 120 and scores them; stage 3 fetches fundamentals
 * for the best 36 and scores those. Results appear as each stage finishes and are saved in this browser.
 */
export function useMultibagger() {
  const { stocks } = useUniverse();
  const [items, setItems] = useState<Candidate[]>([]);
  const [progress, setProgress] = useState<MbProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const running = useRef(false);
  const started = useRef(false);

  const run = useCallback(async () => {
    if (running.current || !stocks) return;
    running.current = true; setError(null);
    try {
      setProgress({ phase: "market", done: 0, total: 1, screened: 0 });
      const res = await fetch("/api/market"); const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not load the market");
      const rows = j.rows as MarketRow[] ?? parseMarket(j);
      const capMap = new Map(stocks.map((s) => [s.symbol.replace(/\.NS$/, ""), s.cap]));
      const names = new Map(stocks.map((s) => [s.symbol.replace(/\.NS$/, ""), s.name]));
      const s1 = stage1(rows, (sym) => capMap.get(sym));
      setTotal(rows.length);
      const sectors = new Map(stocks.map((s) => [s.symbol.replace(/\.NS$/, ""), s.sector]));
      // 120 to chart, spread across categories so every sector with a candidate is represented, not just the loudest ones.
      const shortlist = diversify(s1, (x) => sectors.get(x.row.symbol) ?? "Unclassified", 120, 8, 25);

      const base: Candidate[] = [];
      let done = 0;
      setProgress({ phase: "charts", done: 0, total: shortlist.length, screened: rows.length });
      await prefetchDaily(shortlist.map((s) => `${s.row.symbol}.NS`), 520);
      await pool(shortlist, 10, async (s) => {
        try {
          const candles = await fetchCandles(`${s.row.symbol}.NS`, 520);
          const ta = analyseTa(candles);
          if (ta) base.push({ symbol: s.row.symbol, sector: sectors.get(s.row.symbol) ?? "Unclassified", name: names.get(s.row.symbol) ?? nameOf(s.row.symbol), bucket: s.bucket, row: s.row, why: s.why, ta, fa: null, faScore: null, faState: "pending", score: null, call: "pending" });
        } catch { /* no history for this one */ }
        if (++done % 10 === 0 || done === shortlist.length) { setProgress({ phase: "charts", done, total: shortlist.length, screened: rows.length }); setItems([...base].sort(rank)); }
      });
      const top = diversify([...base].filter((c) => c.ta.score >= 45).sort((a, b) => b.ta.score - a.ta.score), (c) => c.sector, 36, 4, 8);
      const topSet = new Set(top.map((t) => t.symbol));
      for (const c of base) if (!topSet.has(c.symbol)) c.faState = "none";
      setItems([...base].sort(rank));

      let fd = 0;
      setProgress({ phase: "fundamentals", done: 0, total: top.length, screened: rows.length });
      for (let i = 0; i < top.length; i += 12) {
        const batch = top.slice(i, i + 12);
        try {
          const r = await fetch(`/api/fundamentals?symbols=${batch.map((b) => b.symbol).join(",")}`); const d = await r.json();
          for (const c of batch) {
            const f = (d.data?.[c.symbol] ?? null) as Fundamentals | null;
            c.fa = f; c.faScore = f ? scoreFundamentals(f) : null; c.faState = f ? "ok" : "none";
            const m = combine(c.faScore, c.ta); c.score = m.score; c.call = c.faState === "none" ? "pending" : m.call;
            // SME-platform stocks trade in fixed lots, very thinly and with lighter disclosure: never a "strong" call.
            if (c.bucket === "sme") { if (!c.ta.flags.some((x) => x.startsWith("SME"))) c.ta.flags.push("SME-platform listing: trades in fixed lots, very thinly, with lighter disclosure than the main board"); if (c.call === "strong") c.call = "watch"; }
          }
        } catch { for (const c of batch) c.faState = "none"; }
        fd += batch.length;
        setProgress({ phase: "fundamentals", done: fd, total: top.length, screened: rows.length });
        setItems([...base].sort(rank));
      }
      const final = [...base].sort(rank);
      setItems(final); setSavedAt(Date.now());
      try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), screened: rows.length, total: rows.length, items: final.slice(0, 120) } satisfies Saved)); } catch { /* storage full */ }
      setProgress({ phase: "done", done: top.length, total: top.length, screened: rows.length });
    } catch (e) { setError((e as Error).message); setProgress(null); }
    finally { running.current = false; }
  }, [stocks]);

  useEffect(() => {
    if (started.current || !stocks) return;
    started.current = true;
    const saved = read();
    /* eslint-disable react-hooks/set-state-in-effect -- show the saved hunt right after mount */
    if (saved) { setItems(saved.items); setSavedAt(saved.at); setTotal(saved.total); }
    /* eslint-enable react-hooks/set-state-in-effect */
    if (!saved || Date.now() - saved.at > STALE_MS) setTimeout(() => void run(), 0);
  }, [stocks, run]);

  return { items, progress, error, savedAt, total, rescan: run, busy: !!progress && progress.phase !== "done" };
}
