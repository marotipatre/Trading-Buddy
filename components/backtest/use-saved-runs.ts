"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isMissingTable } from "@/lib/paper/store";
import { parseRun, type SavedConfig, type SavedRun, type Summary } from "@/lib/saved-backtests";

const LOCAL_KEY = "trading-buddy:saved-runs:v1";

function readLocal(): SavedRun[] {
  try {
    const v = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]");
    return Array.isArray(v) ? (v as SavedRun[]) : [];
  } catch {
    return [];
  }
}
const writeLocal = (runs: SavedRun[]) => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(runs.slice(0, 100))); } catch {} };

/** Saved backtests in Supabase (private to you), or in this browser if the table has not been created yet. */
export function useSavedRuns() {
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [ready, setReady] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);
  const supabase = useRef(createClient());

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.current.from("saved_backtests").select("id,name,symbol,years,strategy,summary,created_at").order("created_at", { ascending: false }).limit(100);
      if (!alive) return;
      if (error) {
        if (isMissingTable(error)) { setLocalOnly(true); setRuns(readLocal()); }
      } else {
        setRuns((data ?? []).map((r) => parseRun(r as never)).filter((r): r is SavedRun => r !== null));
      }
      setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  const save = useCallback(async (name: string, config: SavedConfig, summary: Summary): Promise<{ error?: string }> => {
    const clean = name.trim().slice(0, 80) || summary.label;
    if (localOnly) {
      const run: SavedRun = { id: `local-${Date.now()}`, name: clean, createdAt: Math.floor(Date.now() / 1000), config, summary };
      setRuns((cur) => { const next = [run, ...cur]; writeLocal(next); return next; });
      return {};
    }
    const { data, error } = await supabase.current.from("saved_backtests")
      .insert({ name: clean, symbol: config.symbol ?? summary.label.slice(0, 60), years: config.years, strategy: { config }, summary })
      .select("id,name,symbol,years,strategy,summary,created_at").single();
    if (error) return { error: error.message };
    const run = parseRun(data as never);
    if (run) setRuns((cur) => [run, ...cur]);
    return {};
  }, [localOnly]);

  const remove = useCallback(async (id: string) => {
    const before = runs;
    setRuns((cur) => cur.filter((r) => r.id !== id));
    if (id.startsWith("local-")) { writeLocal(before.filter((r) => r.id !== id)); return; }
    const { error } = await supabase.current.from("saved_backtests").delete().eq("id", id);
    if (error) setRuns(before);
  }, [runs]);

  return { runs, ready, localOnly, save, remove };
}
