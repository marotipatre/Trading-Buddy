import { pool } from "@/lib/analysis/pool";
import { getIndexHistory, getMarketBreadth, getMarketMood } from "@/lib/data/nse-mcp";
import { BENCHMARK_INDEX, SECTOR_INDICES, sectorOutlook, type Bar, type SectorOutlook } from "./outlook";

export interface SectorsPayload {
  asOf: string;
  benchmark: { index: string; close: number; returns: SectorOutlook["returns"] };
  sectors: SectorOutlook[];
  breadth?: { advances: number; declines: number; unchanged: number; total: number; adRatio: number };
  vix?: { level: number; change1dPct?: number };
  source: string;
  failed: string[];
}

const toBars = (h: Awaited<ReturnType<typeof getIndexHistory>>): Bar[] => h.data.map((d) => ({ date: d.date, close: d.close, pe: d.pe }));

/** Pull every sector index and the benchmark from NSE's MCP server and compute the outlook. Slow (about 30 calls): cache the result. */
export async function loadSectors(): Promise<SectorsPayload> {
  const bench = toBars(await getIndexHistory(BENCHMARK_INDEX, 14));
  const out: SectorOutlook[] = [];
  const failed: string[] = [];
  await pool(SECTOR_INDICES, 4, async (s) => {
    try {
      const o = sectorOutlook(s.index, s.label, toBars(await getIndexHistory(s.index, 14)), bench);
      if (o) out.push(o); else failed.push(s.index);
    } catch { failed.push(s.index); }
  });
  const [breadth, mood] = await Promise.allSettled([getMarketBreadth(), getMarketMood()]);
  const m = mood.status === "fulfilled" ? (mood.value as { india_vix?: { level?: number; change_1d_pct?: number } }) : undefined;
  const closes = bench.map((b) => b.close);
  const k = (n: number) => (closes.length > n ? (closes[closes.length - 1] / closes[closes.length - 1 - n] - 1) * 100 : NaN);
  return {
    asOf: bench[bench.length - 1]?.date ?? "",
    benchmark: { index: BENCHMARK_INDEX, close: closes[closes.length - 1], returns: { d1: k(1), w1: k(5), m1: k(21), m3: k(63), m6: k(126), y1: k(252) } },
    sectors: out.sort((a, b) => b.score - a.score),
    breadth: breadth.status === "fulfilled" ? { advances: breadth.value.advances, declines: breadth.value.declines, unchanged: breadth.value.unchanged, total: breadth.value.total_stocks, adRatio: breadth.value.ad_ratio } : undefined,
    vix: m?.india_vix?.level !== undefined ? { level: m.india_vix.level, change1dPct: m.india_vix.change_1d_pct } : undefined,
    source: "NSE official MCP (end-of-day index data)",
    failed,
  };
}
