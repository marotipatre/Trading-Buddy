"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SimpleSelect } from "@/components/backtest/simple-select";
import { StockRow } from "@/components/stock-row";
import { useBatchedQuotes } from "@/components/use-batched-quotes";
import { useUniverse } from "@/components/use-universe";
import { useWatchlist } from "@/components/use-watchlist";
import { CAP_LABEL, filterUniverse, type Cap } from "@/lib/universe-data";
import { cn } from "@/lib/utils";

const CAPS = ["all", "large", "mid", "small"] as const;
const PAGE = 20;
const SORT_OPTIONS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "gainers", label: "Top gainers" },
  { value: "losers", label: "Top losers" },
] as const;
type Sort = (typeof SORT_OPTIONS)[number]["value"];
/** Sorting by day change needs every price in the list, so it is only offered for groups this small. */
const MAX_FOR_MOVERS = 120;

export function StocksBrowser() {
  const router = useRouter();
  const params = useSearchParams();
  const cap = (CAPS as readonly string[]).includes(params.get("cap") ?? "") ? (params.get("cap") as (typeof CAPS)[number]) : "all";
  const sector = params.get("sector") ?? "all";
  const q = params.get("q") ?? "";
  const sort = (SORT_OPTIONS.map((o) => o.value) as string[]).includes(params.get("sort") ?? "") ? (params.get("sort") as Sort) : "name";
  const pages = Math.max(1, Number(params.get("pages")) || 1);

  const { stocks, sectors, loading, error } = useUniverse();
  const wl = useWatchlist();

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === "all" || (k === "sort" && v === "name") || (k === "pages" && v === "1")) next.delete(k);
      else next.set(k, v);
    }
    if (!("pages" in patch)) next.delete("pages");
    const qs = next.toString();
    router.replace(`/stocks${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  // Sector counts reflect the chosen size class.
  const inCap = useMemo(() => filterUniverse(stocks ?? [], { cap }), [stocks, cap]);
  const sectorCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of inCap) m.set(s.sector, (m.get(s.sector) ?? 0) + 1);
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [inCap]);
  const filtered = useMemo(() => filterUniverse(stocks ?? [], { cap, sector, q }), [stocks, cap, sector, q]);
  const moversOk = filtered.length <= MAX_FOR_MOVERS;
  const effectiveSort: Sort = sort !== "name" && !moversOk ? "name" : sort;

  const sortedByName = useMemo(() => [...filtered].sort((a, b) => a.name.localeCompare(b.name)), [filtered]);
  // Quotes needed: everything when sorting by change, otherwise just the rows on screen.
  const wanted = useMemo(() => (effectiveSort === "name" ? sortedByName.slice(0, PAGE * pages) : sortedByName), [effectiveSort, sortedByName, pages]);
  const { quotes, done, total } = useBatchedQuotes(useMemo(() => wanted.map((s) => s.symbol), [wanted]));

  const rows = useMemo(() => {
    if (effectiveSort === "name") return sortedByName.slice(0, PAGE * pages);
    const withQ = sortedByName.filter((s) => quotes[s.symbol]);
    withQ.sort((a, b) => (effectiveSort === "gainers" ? quotes[b.symbol].changePct - quotes[a.symbol].changePct : quotes[a.symbol].changePct - quotes[b.symbol].changePct));
    return withQ.slice(0, PAGE * pages);
  }, [effectiveSort, sortedByName, quotes, pages]);
  const available = effectiveSort === "name" ? sortedByName.length : sortedByName.filter((s) => quotes[s.symbol]).length;
  const more = available > rows.length;

  if (error && !stocks) {
    return <Card><p className="px-6 py-10 text-center text-sm text-muted-foreground">{error}</p></Card>;
  }

  const count = (c: (typeof CAPS)[number]) => (c === "all" ? stocks?.length : stocks?.filter((s) => s.cap === c).length);
  const chip = (active: boolean) => cn("shrink-0 rounded-full border px-3 py-1 text-xs transition-colors", active ? "border-primary bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CAPS.map((c) => (
          <Button key={c} size="sm" variant={cap === c ? "default" : "outline"} onClick={() => set({ cap: c, sector: null })}>
            {c === "all" ? "All stocks" : CAP_LABEL[c as Cap]}
            {count(c) !== undefined ? <span className="ml-1 opacity-70">{count(c)}</span> : null}
          </Button>
        ))}
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <button type="button" onClick={() => set({ sector: null })} className={chip(sector === "all")}>All sectors</button>
        {(sectors ? sectorCounts : []).map((s) => (
          <button key={s.name} type="button" onClick={() => set({ sector: s.name })} className={chip(sector === s.name)}>
            {s.name} <span className="opacity-60">{s.count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search by name or ticker" defaultValue={q} key={`${cap}|${sector}`} onChange={(e) => set({ q: e.target.value })} />
        </div>
        <SimpleSelect className="w-44" value={effectiveSort} onChange={(v) => set({ sort: v })}
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.value === "name" || moversOk ? o.label : `${o.label} (pick a sector)` }))} />
        <span className="text-sm text-muted-foreground">{filtered.length} stock{filtered.length === 1 ? "" : "s"}</span>
        {effectiveSort !== "name" && done < total && <span className="text-xs text-muted-foreground">Loading prices {done}/{total}…</span>}
      </div>
      {sort !== "name" && !moversOk && <p className="text-xs text-warn">Day-change sorting needs every price in the list, so choose a sector or a smaller size class first.</p>}

      <Card className="py-0">
        {loading ? Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
            <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-44" /></div>
            <Skeleton className="h-8 w-16" />
          </div>
        )) : rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            {effectiveSort !== "name" && done < total ? "Loading prices…" : "No stocks match. Try another sector or clear the search."}
          </p>
        ) : rows.map((s) => (
          <StockRow key={s.symbol} symbol={s.symbol} name={`${s.name} · ${s.sector}`} quote={quotes[s.symbol]}
            watched={wl.has(s.symbol)} onToggleWatch={() => wl.toggle(s.symbol, s.name)} />
        ))}
      </Card>
      {more && <div className="text-center"><Button variant="outline" onClick={() => set({ pages: String(pages + 1) })}>Show more</Button></div>}
      <p className="text-xs text-muted-foreground">Size classes follow NSE&apos;s Nifty 100 (large), Midcap 150 and Smallcap 250 lists; sectors are NSE&apos;s industry classification.</p>
    </div>
  );
}
