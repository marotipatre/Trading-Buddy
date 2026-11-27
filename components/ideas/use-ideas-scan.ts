"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useUniverse } from "@/components/use-universe";
import { fetchCandles, pool as runPool, prefetchDaily } from "@/lib/analysis/candle-cache";
import { moodOf } from "@/lib/analysis/mood";
import { assessMethod, type Method } from "@/lib/analysis/methods";
import { latestPatterns } from "@/lib/analysis/patterns";
import { computeFeatures } from "@/lib/analysis/features";
import { marketRegime, type MarketRegime } from "@/lib/analysis/regime";
import { HISTORY_DAYS, withRelativeStrength, type Frame } from "@/lib/analysis/stock-view";
import type { BaseIdea } from "@/lib/analysis/ideas-engine";
import { CAP_ORDER, inScope, type ScanScope, type UniverseStock } from "@/lib/universe-lists";
import { isMarketOpen } from "@/lib/market-hours";

const LAST_KEY = "tb.ideas.last.v2";
export interface Progress { done: number; total: number; phase: "prices" | "news"; note: string }
interface Saved { at: number; bases: BaseIdea[]; regime: MarketRegime | null; bench: number | null; method: Method; frame: Frame; scope?: ScanScope }

export const daysFor = (method: Method, frame: Frame) => (method === "trend" ? HISTORY_DAYS[frame] : 800);
const ORDER: Record<UniverseStock["cap"], number> = Object.fromEntries(CAP_ORDER.map((c, i) => [c, i])) as Record<UniverseStock["cap"], number>;

function load(): Saved | null {
  try { const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null") as Saved | null; return v && Array.isArray(v.bases) && v.bases.length ? v : null; } catch { return null; }
}

/**
 * Scans the whole listed market (every NSE stock that trades, large caps first so useful results appear within seconds) and keeps
 * the base results. Your plan (days, target, amount) is applied afterwards, so changing it never needs a rescan.
 * The last scan is shown at once; a stale one is refreshed in the background.
 */
export function useIdeasScan(method: Method, frame: Frame, scope: ScanScope | null) {
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
    if (!scope) return;
    // Every NSE stock is in the universe. To keep the scan fast and the ideas tradable, stocks outside the Nifty 500 are
    // included only if they traded at least about Rs 10 lakh in the last session (from NSE's own live feed).
    let turnover: Map<string, number> | null = null;
    try { const r = await fetch("/api/market"); const j = await r.json(); if (r.ok) turnover = new Map((j.rows as { symbol: string; valueCr: number }[]).map((x) => [x.symbol, x.valueCr])); } catch { /* scan everything without the liquidity gate */ }
    // The feed's "traded value" is today's running total, so early in the session it is small for every stock. Use a much lower
    // first cut while the market is open and judge thin trading properly from each stock's own 20-day average below.
    const gate = isMarketOpen() ? 0.01 : 0.1;
    const tradable = (s: UniverseStock) => !turnover || scope !== "all" || s.cap === "large" || s.cap === "mid" || s.cap === "small" || (turnover.get(s.symbol.replace(/\.NS$/, "")) ?? 0) >= gate;
    const all = [...(stocks ?? [])].filter((s) => inScope(s, scope)).filter(tradable).sort((a, b) => ORDER[a.cap] - ORDER[b.cap] || a.name.localeCompare(b.name));
    if (!all.length) return;
    stopRef.current = false;
    setRunning(true);
    const found: BaseIdea[] = [];
    let done = 0, failed = 0, thin = 0, benchM1 = 0;
    let reg: MarketRegime | null = null;
    try {
      try {
        const nifty = await fetchCandles("^NSEI", 500);
        reg = marketRegime(nifty);
        benchM1 = nifty.length > 21 ? (nifty[nifty.length - 1].close / nifty[nifty.length - 22].close - 1) * 100 : 0;
        setRegime(reg); setBench(benchM1);
      } catch { /* the market comparison is optional */ }

      const days = daysFor(method, frame);
      setProgress({ done: 0, total: all.length, phase: "prices", note: "Loading saved history" });
      await prefetchDaily(all.map((s) => s.symbol), days, () => stopRef.current);
      await runPool(all, 12, async (s) => {
        try {
          const candles = await fetchCandles(s.symbol, days);
          if (scope === "all" && s.cap !== "large" && s.cap !== "mid" && s.cap !== "small") {
            const last = candles.slice(-20);
            const avg = last.length ? last.reduce((t, c) => t + c.close * c.volume, 0) / last.length : 0;
            if (avg < 1_000_000) { thin++; done++; return; } // under about Rs 10 lakh a day: too thin to trade
          }
          const view = assessMethod(s.symbol, candles, method, frame);
          if (view) found.push({ symbol: s.symbol, name: s.name, sector: s.sector, cap: s.cap, view, patterns: latestPatterns(candles).map((p) => ({ name: p.name, bias: p.bias })), feat: computeFeatures(candles) });
          else failed++;
        } catch { failed++; }
        done++;
        if (done % 12 === 0 || done === all.length) {
          setProgress({ done, total: all.length, phase: "prices", note: `${found.length} analysed${thin ? `, ${thin} skipped as too thinly traded` : ""}` });
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
        localStorage.setItem(LAST_KEY, JSON.stringify({ at: Date.now(), bases: keep, regime: reg, bench: benchM1, method, frame, scope } satisfies Saved));
      } catch { /* storage full or unavailable */ }
      if (failed > all.length * 0.3) toast.warning(`${failed} of ${all.length} stocks could not be loaded. Results cover the rest.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, [stocks, method, frame, scope]);

  const stop = useCallback(() => { stopRef.current = true; }, []);

  // First visit: scan at once. A saved scan that has gone stale (or was made with other settings) refreshes in the background.
  useEffect(() => {
    if (startedRef.current || uniLoading || !stocks?.length || !lastLoaded.current || !scope) return;
    const s = load();
    const age = s ? Date.now() - s.at : Infinity;
    const stale = !s || !s.bases.some((b) => b.feat) || s.method !== method || s.frame !== frame || (s.scope ?? "all") !== scope || age > (isMarketOpen() ? 15 * 60_000 : 6 * 3600_000);
    startedRef.current = true;
    if (stale) setTimeout(() => void scan(), 0);
  }, [uniLoading, stocks, method, frame, scope, scan]);

  // Changing the method or candle size is a new question: rescan.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (startedRef.current && !running) setTimeout(() => void scan(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the question changes
  }, [method, frame, scope]);

  return { bases, regime, bench, asOf, running, progress, restored, ranWith, scan, stop, universeReady: !uniLoading && !!stocks?.length, total: stocks?.length ?? 0 };
}
