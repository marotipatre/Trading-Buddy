"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useUniverse } from "@/components/use-universe";
import { fetchCandles, pool as runPool } from "@/lib/analysis/candle-cache";
import { moodOf } from "@/lib/analysis/mood";
import { assessMethod, type Method } from "@/lib/analysis/methods";
import { latestPatterns } from "@/lib/analysis/patterns";
import { computeFeatures } from "@/lib/analysis/features";
import { marketRegime, type MarketRegime } from "@/lib/analysis/regime";
import { HISTORY_DAYS, withRelativeStrength, type Frame } from "@/lib/analysis/stock-view";
import type { BaseIdea } from "@/lib/analysis/ideas-engine";
import type { UniverseStock } from "@/lib/universe-lists";
import { isMarketOpen } from "@/lib/market-hours";

const LAST_KEY = "tb.ideas.last.v2";
export interface Progress { done: number; total: number; phase: "prices" | "news"; note: string }
interface Saved { at: number; bases: BaseIdea[]; regime: MarketRegime | null; bench: number | null; method: Method; frame: Frame }

export const daysFor = (method: Method, frame: Frame) => (method === "trend" ? HISTORY_DAYS[frame] : 800);
const ORDER: Record<UniverseStock["cap"], number> = { large: 0, mid: 1, small: 2 };

function load(): Saved | null {
  try { const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null") as Saved | null; return v && Array.isArray(v.bases) && v.bases.length ? v : null; } catch { return null; }
}

/**
 * Scans the whole listed market (about 500 stocks, large caps first so useful results appear within seconds) and keeps
 * the base results. Your plan (days, target, amount) is applied afterwards, so changing it never needs a rescan.
 * The last scan is shown at once; a stale one is refreshed in the background.
 */
export function useIdeasScan(method: Method, frame: Frame) {
  const { stocks, loading: uniLoading } = useUniverse();
  const [bases, setBases] = useState<BaseIdea[]>([]);
  const [regime, setRegime] = useState<MarketRegime | null>(null);
  const [bench, setBench] = useState<number | null>(null);
  const [asOf, setAsOf] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [restored, setRestored] = useState(false);
  const [ranWith, setRanWith] = useState<{ method: Method; frame: Frame }>({ method, frame });
  const stopRef = useRef(false);
  const startedRef = useRef(false);
  const lastLoaded = useRef(false);

  // Show the last scan immediately.
  useEffect(() => {
    const s = load();
    lastLoaded.current = true;
    if (!s) return;
    /* eslint-disable react-hooks/set-state-in-effect -- restore the saved scan after mount */
    setBases(s.bases); setRegime(s.regime); setBench(s.bench); setAsOf(s.at); setRestored(true); setRanWith({ method: s.method, frame: s.frame });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const scan = useCallback(async () => {
    const all = [...(stocks ?? [])].sort((a, b) => ORDER[a.cap] - ORDER[b.cap] || a.name.localeCompare(b.name));
    if (!all.length) return;
    stopRef.current = false;
    setRunning(true);
    const found: BaseIdea[] = [];
    let done = 0, failed = 0, benchM1 = 0;
    let reg: MarketRegime | null = null;
    try {
      try {
        const nifty = await fetchCandles("^NSEI", 500);
        reg = marketRegime(nifty);
        benchM1 = nifty.length > 21 ? (nifty[nifty.length - 1].close / nifty[nifty.length - 22].close - 1) * 100 : 0;
        setRegime(reg); setBench(benchM1);
      } catch { /* the market comparison is optional */ }

      const days = daysFor(method, frame);
      await runPool(all, 12, async (s) => {
        try {
          const candles = await fetchCandles(s.symbol, days);
          const view = assessMethod(s.symbol, candles, method, frame);
          if (view) found.push({ symbol: s.symbol, name: s.name, sector: s.sector, cap: s.cap, view, patterns: latestPatterns(candles).map((p) => ({ name: p.name, bias: p.bias })), feat: computeFeatures(candles) });
          else failed++;
        } catch { failed++; }
        done++;
        if (done % 12 === 0 || done === all.length) {
          setProgress({ done, total: all.length, phase: "prices", note: `${found.length} analysed` });
          setBases([...found]);
        }
      }, () => stopRef.current);
      if (!found.length) throw new Error("No stock could be analysed. Check your connection and try again.");

      // Judge each stock against the others scanned, once the whole market is in.
      if (method === "trend") { const ranked = withRelativeStrength(found.map((f) => f.view)); found.forEach((f, i) => { f.view = ranked[i]; }); }
      setBases([...found]); setAsOf(Date.now()); setRestored(false); setRanWith({ method, frame });

      // News and broker calls for the strongest names only.
      const top = [...found].filter((f) => f.view.verdict !== "avoid").sort((a, b) => b.view.score - a.view.score).slice(0, 12);
      let n = 0;
      await runPool(top, 3, async (f) => {
        try {
          const res = await fetch(`/api/news?name=${encodeURIComponent(f.name)}&price=${Math.round(f.view.price)}`);
          const j = await res.json();
          if (res.ok) { const mood = await moodOf(j.news); f.overlay = { mood: mood.score, moodSource: mood.source, moodCount: mood.count, summary: j.summary }; }
        } catch { /* news is optional */ }
        setProgress({ done: ++n, total: top.length, phase: "news", note: "Reading headlines and broker calls" });
      }, () => stopRef.current);
      setBases([...found]);
      try {
        const keep = [...found].sort((a, b) => b.view.score - a.view.score).slice(0, 250);
        localStorage.setItem(LAST_KEY, JSON.stringify({ at: Date.now(), bases: keep, regime: reg, bench: benchM1, method, frame } satisfies Saved));
      } catch { /* storage full or unavailable */ }
      if (failed > all.length * 0.3) toast.warning(`${failed} of ${all.length} stocks could not be loaded. Results cover the rest.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, [stocks, method, frame]);

  const stop = useCallback(() => { stopRef.current = true; }, []);

  // First visit: scan at once. A saved scan that has gone stale (or was made with other settings) refreshes in the background.
  useEffect(() => {
    if (startedRef.current || uniLoading || !stocks?.length || !lastLoaded.current) return;
    const s = load();
    const age = s ? Date.now() - s.at : Infinity;
    const stale = !s || s.method !== method || s.frame !== frame || age > (isMarketOpen() ? 15 * 60_000 : 6 * 3600_000);
    startedRef.current = true;
    if (stale) setTimeout(() => void scan(), 0);
  }, [uniLoading, stocks, method, frame, scan]);

  // Changing the method or candle size is a new question: rescan.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (startedRef.current && !running) setTimeout(() => void scan(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the question changes
  }, [method, frame]);

  return { bases, regime, bench, asOf, running, progress, restored, ranWith, scan, stop, universeReady: !uniLoading && !!stocks?.length, total: stocks?.length ?? 0 };
}
