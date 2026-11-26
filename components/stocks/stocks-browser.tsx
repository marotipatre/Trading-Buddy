"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useUniverse } from "@/components/use-universe";
import { useWatchlist } from "@/components/use-watchlist";
import { CAP_LABEL, CAP_ORDER, CAP_SHORT, filterUniverse, type UniverseStock } from "@/lib/universe-lists";
import type { MarketRow } from "@/lib/multibagger/market";
import { displaySymbol } from "@/lib/symbols";
import { cn } from "@/lib/utils";
import { PillTabs } from "@/components/motion/primitives";
import { motion } from "motion/react";
import { useMarketFeed } from "./use-market-feed";

const CAPS = ["all", ...CAP_ORDER] as const;
const PAGE = 100;
type SortKey = "name" | "price" | "chg" | "chg30" | "high" | "turnover";
const COLS: { key: SortKey; label: string; hide?: string }[] = [
  { key: "name", label: "Stock" }, { key: "price", label: "Price" }, { key: "chg", label: "Today" },
  { key: "chg30", label: "30 days", hide: "hidden md:table-cell" }, { key: "high", label: "52-week range", hide: "hidden lg:table-cell" }, { key: "turnover", label: "Traded today", hide: "hidden xl:table-cell" },
];
const pct = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "-" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);
const tone = (n: number | null | undefined) => (n === null || n === undefined ? "" : n >= 0 ? "text-up" : "text-down");
const crore = (n: number) => (n * 100 < 1 ? "under ₹1 lakh" : n >= 100 ? `₹${Math.round(n).toLocaleString("en-IN")} cr` : n >= 1 ? `₹${n.toFixed(1)} cr` : `₹${(n * 100).toFixed(0)} lakh`);

function RangeBar({ r }: { r: MarketRow }) {
  const span = r.high52 - r.low52;
  if (!(span > 0)) return <span className="text-muted-foreground">-</span>;
  const p = Math.min(100, Math.max(0, ((r.price - r.low52) / span) * 100));
  return (
    <div className="w-40" title={`52-week low ${r.low52} · high ${r.high52}`}>
      <div className="relative h-1.5 rounded-full bg-muted"><span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card" style={{ left: `${p}%` }} /></div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground"><span>{r.low52.toLocaleString("en-IN")}</span><span>{r.high52.toLocaleString("en-IN")}</span></div>
    </div>
  );
}

/** Every NSE stock in one sortable table, with price, change, 52-week range and turnover from NSE's market feed. */
export function StocksBrowser() {
  const router = useRouter();
  const params = useSearchParams();
  const cap = (CAPS as readonly string[]).includes(params.get("cap") ?? "") ? (params.get("cap") as (typeof CAPS)[number]) : "all";
  const sector = params.get("sector") ?? "all";
  const q = params.get("q") ?? "";
  const sort = (COLS.map((c) => c.key) as string[]).includes(params.get("sort") ?? "") ? (params.get("sort") as SortKey) : "name";
  const dir = params.get("dir") === "desc" || (sort !== "name" && params.get("dir") !== "asc") ? "desc" : "asc";
  const pages = Math.max(1, Number(params.get("pages")) || 1);

  const { stocks, sectors, loading, error } = useUniverse();
  const feed = useMarketFeed();
  const wl = useWatchlist();

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === "" || v === "all") next.delete(k); else next.set(k, v); }
    if (!("pages" in patch)) next.delete("pages");
    const qs = next.toString();
    router.replace(`/stocks${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const inCap = useMemo(() => filterUniverse(stocks ?? [], { cap }), [stocks, cap]);
  const sectorCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of inCap) m.set(s.sector, (m.get(s.sector) ?? 0) + 1);
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [inCap]);
  const filtered = useMemo(() => filterUniverse(stocks ?? [], { cap, sector, q }), [stocks, cap, sector, q]);

  const sorted = useMemo(() => {
    const rows = feed.rows;
    const val = (s: UniverseStock): number | null => {
      const r = rows?.get(s.symbol);
      if (!r) return null;
      return sort === "price" ? r.price : sort === "chg" ? r.chgPct : sort === "chg30" ? r.chg30d : sort === "turnover" ? r.valueCr : sort === "high" ? (r.high52 > 0 ? r.price / r.high52 : null) : null;
    };
    const out = [...filtered];
    if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
    else out.sort((a, b) => { const x = val(a), y = val(b); if (x === null && y === null) return 0; if (x === null) return 1; if (y === null) return -1; return dir === "desc" ? y - x : x - y; });
    if (sort === "name" && dir === "desc") out.reverse();
    return out;
  }, [filtered, feed.rows, sort, dir]);
  const shown = sorted.slice(0, PAGE * pages);

  if (error && !stocks) return <p className="rounded-2xl border bg-card px-6 py-10 text-center text-sm text-muted-foreground">{error}</p>;

  const count = (c: (typeof CAPS)[number]) => (c === "all" ? stocks?.length : stocks?.filter((s) => s.cap === c).length);
  const chip = (active: boolean) => cn("shrink-0 rounded-full border px-3 py-1 text-xs transition-colors", active ? "border-primary bg-primary/10 font-medium text-primary" : "bg-card text-muted-foreground hover:text-foreground");
  const headClick = (k: SortKey) => set({ sort: k === "name" ? null : k, dir: k === sort ? (dir === "desc" ? "asc" : "desc") : null });

  return (
    <div className="space-y-4">
      <PillTabs value={cap} onChange={(c) => set({ cap: c, sector: null })} ariaLabel="Size class" options={CAPS.map((c) => ({ value: c, label: c === "all" ? "All" : CAP_LABEL[c], badge: count(c)?.toLocaleString("en-IN") }))} />

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <button type="button" onClick={() => set({ sector: null })} className={chip(sector === "all")}>All sectors</button>
        {(sectors ? sectorCounts : []).map((s) => (
          <button key={s.name} type="button" onClick={() => set({ sector: s.name })} className={chip(sector === s.name)}>{s.name} <span className="opacity-60">{s.count}</span></button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input className="h-9 rounded-[10px] pl-9" placeholder="Search by name or ticker" defaultValue={q} key={`${cap}|${sector}`} onChange={(e) => set({ q: e.target.value })} />
        </div>
        <span className="text-sm text-muted-foreground">{sorted.length.toLocaleString("en-IN")} stock{sorted.length === 1 ? "" : "s"}{feed.rows ? "" : " · loading prices…"}</span>
        <div className="ml-auto flex gap-1.5 md:hidden">
          {(["chg", "turnover"] as const).map((k) => <button key={k} type="button" className={chip(sort === k)} onClick={() => headClick(k)}>{k === "chg" ? "Biggest movers" : "Most traded"}</button>)}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              {COLS.map((c) => (
                <th key={c.key} className={cn("px-4 py-3 font-medium", c.key !== "name" && c.key !== "high" && "text-right", c.hide)} aria-sort={sort === c.key ? (dir === "desc" ? "descending" : "ascending") : "none"}>
                  <button type="button" onClick={() => headClick(c.key)} className={cn("inline-flex items-center gap-1 hover:text-foreground", sort === c.key && "text-foreground")}>
                    {c.label}{sort === c.key && (dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
                  </button>
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? Array.from({ length: 10 }, (_, i) => <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>)
              : shown.length === 0 ? <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No stocks match. Try another sector or clear the search.</td></tr>
              : shown.map((s, i) => {
                const r = feed.rows?.get(s.symbol);
                return (
                  <motion.tr key={s.symbol} layout={shown.length <= 150 ? "position" : false} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34, delay: Math.min(i, 14) * 0.015 }} className="group transition-colors hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/trade?symbol=${encodeURIComponent(s.symbol)}`} className="block min-w-0">
                        <span className="font-semibold">{displaySymbol(s.symbol)}</span>
                        <span className="mt-0.5 block max-w-[16rem] truncate text-xs text-muted-foreground">{s.name} · {CAP_SHORT[s.cap]}{s.sector !== "Unclassified" ? ` · ${s.sector}` : ""}</span>
                      </Link>
                    </td>
                    <td className="figure px-4 py-2.5 text-right text-[15px]">{r ? r.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>
                    <td className={cn("px-4 py-2.5 text-right font-mono font-medium", tone(r?.chgPct))}>{pct(r?.chgPct)}</td>
                    <td className={cn("hidden px-4 py-2.5 text-right font-mono md:table-cell", tone(r?.chg30d))}>{pct(r?.chg30d)}</td>
                    <td className="hidden px-4 py-2.5 lg:table-cell">{r ? <RangeBar r={r} /> : <span className="text-muted-foreground">-</span>}</td>
                    <td className="hidden px-4 py-2.5 text-right font-mono text-muted-foreground xl:table-cell">{r ? crore(r.valueCr) : "-"}</td>
                    <td className="pr-3 text-right">
                      <button type="button" aria-label={wl.has(s.symbol) ? "Remove from watchlist" : "Add to watchlist"} onClick={() => wl.toggle(s.symbol, s.name)} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
                        <Star className={cn("size-4", wl.has(s.symbol) && "fill-warn text-warn")} />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {sorted.length > shown.length && <div className="text-center"><Button variant="outline" onClick={() => set({ pages: String(pages + 1) })}>Show {Math.min(PAGE, sorted.length - shown.length)} more</Button></div>}
      <p className="text-xs leading-relaxed text-muted-foreground">Prices and changes come from NSE&apos;s official market feed (a minute or two behind during the session). Size classes follow NSE&apos;s Nifty 100 (large), Midcap 150, Smallcap 250 and Microcap 250 lists; &quot;Other listed&quot; is any other mainboard stock and &quot;SME&quot; is NSE&apos;s SME platform, both without sector data. Click a column to sort, for example by traded value to find the most active stocks.</p>
    </div>
  );
}
