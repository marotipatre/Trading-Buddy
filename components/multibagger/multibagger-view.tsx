"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BUCKET_LABEL, type Bucket } from "@/lib/multibagger/screen";
import type { Call } from "@/lib/multibagger/ta";
import { cn } from "@/lib/utils";
import { useMultibagger, type Candidate } from "./use-multibagger";

const CALL: Record<Call, { label: string; cls: string }> = {
  strong: { label: "Strong candidate", cls: "bg-up/15 text-up" },
  watch: { label: "Watch", cls: "bg-warn/15 text-warn" },
  avoid: { label: "Weak case", cls: "bg-down/15 text-down" },
  pending: { label: "Checking…", cls: "bg-muted text-muted-foreground" },
};
const PHASE = { market: "Reading every listed stock from NSE…", charts: "Drawing and scoring charts…", fundamentals: "Reading company financials…", done: "Done" } as const;
const f1 = (n?: number | null, suffix = "") => (n === undefined || n === null || !Number.isFinite(n) ? "-" : `${n.toFixed(n >= 100 ? 0 : 1)}${suffix}`);

function Ring({ value }: { value: number | null }) {
  const v = value ?? 0, r = 15, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 40 40" className="size-11 shrink-0" role="img" aria-label={value === null ? "Score pending" : `Score ${value} of 100`}>
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--muted)" strokeWidth="4" />
      {value !== null && <circle cx="20" cy="20" r={r} fill="none" stroke={v >= 65 ? "var(--up)" : v >= 50 ? "var(--warn)" : "var(--down)"} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 20 20)" />}
      <text x="20" y="24" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--foreground)">{value === null ? "…" : value}</text>
    </svg>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return <div className="min-w-0"><div className="text-[11px] text-muted-foreground">{label}</div><div className={cn("tabular font-mono text-sm font-medium", tone === "up" && "text-up", tone === "down" && "text-down")}>{value}</div></div>;
}

function Row({ c }: { c: Candidate }) {
  const [open, setOpen] = useState(false);
  const fa = c.fa, ta = c.ta;
  return (
    <li className="rounded-xl border bg-card">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-3 sm:grid-cols-[auto_minmax(9rem,1.1fr)_repeat(4,minmax(4.5rem,1fr))_auto]">
        <Ring value={c.score} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5"><b className="font-mono">{c.symbol}</b><span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", CALL[c.call].cls)}>{CALL[c.call].label}</span></div>
          <div className="truncate text-xs text-muted-foreground">{fa?.name ?? c.name} · {BUCKET_LABEL[c.bucket]} · ₹{c.row.price.toLocaleString("en-IN")}</div>
        </div>
        <div className="contents">
          <div className="hidden sm:block"><Metric label="Profit growth (3y)" value={f1(fa?.profit3y, "%")} tone={fa?.profit3y === undefined ? undefined : fa.profit3y >= 15 ? "up" : fa.profit3y < 0 ? "down" : undefined} /></div>
          <div className="hidden sm:block"><Metric label="ROCE" value={f1(fa?.roce, "%")} tone={fa?.roce === undefined ? undefined : fa.roce >= 18 ? "up" : fa.roce < 8 ? "down" : undefined} /></div>
          <div className="hidden sm:block"><Metric label="Debt / equity" value={f1(fa?.debtToEquity)} tone={fa?.debtToEquity === undefined ? undefined : fa.debtToEquity < 0.5 ? "up" : fa.debtToEquity > 1.5 ? "down" : undefined} /></div>
          <div className="hidden sm:block"><Metric label="6-month move" value={ta.ret6m === null ? "-" : `${ta.ret6m >= 0 ? "+" : ""}${ta.ret6m.toFixed(0)}%`} tone={ta.ret6m === null ? undefined : ta.ret6m >= 0 ? "up" : "down"} /></div>
        </div>
        <button type="button" aria-expanded={open} aria-label={open ? "Hide details" : "Show details"} onClick={() => setOpen((o) => !o)} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} /></button>
      </div>
      {open && (
        <div className="grid gap-4 border-t p-4 text-sm md:grid-cols-2">
          <div className="space-y-2">
            <h4 className="font-semibold">The business (fundamentals{c.faScore ? `: ${c.faScore.score}/100` : ""})</h4>
            {fa ? (
              <>
                <div className="grid grid-cols-3 gap-3"><Metric label="Market value" value={fa.mcapCr ? `₹${fa.mcapCr.toLocaleString("en-IN")} cr` : "-"} /><Metric label="P/E" value={f1(fa.pe)} /><Metric label="Sales growth (3y)" value={f1(fa.sales3y, "%")} /><Metric label="Profit growth (12m)" value={f1(fa.profitTtm, "%")} /><Metric label="ROE" value={f1(fa.roe, "%")} /><Metric label="Promoters own" value={f1(fa.promoter, "%")} /></div>
                {c.faScore?.reasons.map((r) => <p key={r} className="text-up">✓ {r}</p>)}
                {c.faScore?.flags.map((r) => <p key={r} className="text-down">⚠ {r}</p>)}
              </>
            ) : <p className="text-muted-foreground">{c.faState === "pending" ? "Reading financials…" : "Financials were not checked for this stock (it ranked below the top 36 on its chart) or could not be read."}</p>}
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">The chart (technical: {ta.score}/100)</h4>
            <div className="grid grid-cols-3 gap-3"><Metric label="From 1-year high" value={`-${ta.fromHighPct.toFixed(0)}%`} /><Metric label="12-month move" value={ta.ret12m === null ? "-" : `${ta.ret12m >= 0 ? "+" : ""}${ta.ret12m.toFixed(0)}%`} /><Metric label="Worst fall (1y)" value={`-${ta.maxDd1y.toFixed(0)}%`} /><Metric label="Trades a day" value={`₹${(ta.avgTurnoverCr * 100).toFixed(0)} lakh`} /><Metric label="Volume vs norm" value={ta.volTrend ? `${ta.volTrend.toFixed(1)}x` : "-"} /><Metric label="Uptrend stage" value={ta.stage2 ? "Stage 2" : "Not yet"} /></div>
            {ta.reasons.map((r) => <p key={r} className="text-up">✓ {r}</p>)}
            {ta.flags.map((r) => <p key={r} className="text-down">⚠ {r}</p>)}
            {c.why.length > 0 && <p className="text-xs text-muted-foreground">Found because: {c.why.join("; ")}.</p>}
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Link href={`/trade?symbol=${encodeURIComponent(c.symbol + ".NS")}`} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Chart &amp; paper trade</Link>
            <a href={`https://www.screener.in/company/${encodeURIComponent(c.symbol)}/`} target="_blank" rel="noreferrer noopener" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent">Full financials (screener.in)</a>
          </div>
        </div>
      )}
    </li>
  );
}

export function MultibaggerView() {
  const mb = useMultibagger();
  const [bucket, setBucket] = useState<Bucket | "all">("all");
  const [show, setShow] = useState<"ranked" | "all">("ranked");
  const [q, setQ] = useState("");
  const anyScored = mb.items.some((c) => c.score !== null);
  const shown = useMemo(() => mb.items.filter((c) => (bucket === "all" || c.bucket === bucket) && (show === "all" || !anyScored || c.score !== null) && (!q || `${c.symbol} ${c.name}`.toLowerCase().includes(q.toLowerCase()))), [mb.items, bucket, show, q, anyScored]);
  const strong = mb.items.filter((c) => c.call === "strong").length;
  const p = mb.progress;
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm">
        <b>Read this first.</b> A multibagger is a stock that grows 5 to 10 times. Many small and penny stocks fall or become impossible to sell, and some are manipulated. This tab only lists stocks that pass <b>both</b> a financial check and a chart check, and flags the dangers. It narrows the haystack; it does not predict winners. Paper trade first, keep each position small, and read the company before you buy.
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{mb.busy && p ? PHASE[p.phase] : mb.savedAt ? `Updated ${new Date(mb.savedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Not run yet"}</div>
          <div className="text-xs text-muted-foreground">{p && p.screened ? `${p.screened.toLocaleString("en-IN")} listed stocks screened → best 120 charted → best 36 checked for financials` : mb.total ? `${mb.total.toLocaleString("en-IN")} listed stocks screened` : "Screens every stock listed on NSE: small caps, micro caps and penny stocks"}</div>
          {mb.busy && p && p.total > 0 && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(p.done / p.total) * 100}%` }} /></div>}
        </div>
        <Button variant="outline" onClick={() => void mb.rescan()} disabled={mb.busy}>{mb.busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}Rescan</Button>
      </div>
      {mb.error && <p className="rounded-xl border border-down/40 bg-down/10 p-3 text-sm text-down">{mb.error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {([["all", "All"], ["small", "Small cap"], ["micro", "Micro cap"], ["penny", "Penny (under ₹50)"], ["other", "Other listed"], ["sme", "SME (Emerge)"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setBucket(k)} className={cn("rounded-full border px-3 py-1 text-xs font-medium", bucket === k ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" onClick={() => setShow(show === "ranked" ? "all" : "ranked")} className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">{show === "ranked" ? "Showing: fully checked only" : "Showing: all charted"}</button>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search" className="ml-auto h-8 w-40 rounded-lg border bg-background px-2.5 text-sm" />
      </div>
      {strong > 0 && <p className="text-sm text-muted-foreground"><b className="text-up">{strong}</b> strong candidate{strong > 1 ? "s" : ""} right now. &quot;Strong&quot; needs good financials and a healthy chart and at most one red flag.</p>}

      {mb.items.length === 0 ? (
        <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[4.5rem] w-full rounded-xl" />)}</div>
      ) : shown.length === 0 ? <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Nothing matches these filters yet. {mb.busy ? "Results are still arriving." : "Try another group."}</p>
        : <ul className="space-y-2">{shown.map((c) => <Row key={c.symbol} c={c} />)}</ul>}

      <details className="rounded-xl border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">How the score works</summary>
        <div className="mt-3 space-y-2 text-muted-foreground">
          <p><b className="text-foreground">Step 1, the whole market.</b> NSE&apos;s official feed lists about 3,500 stocks (mainboard plus SME). We drop ETFs, large and mid caps (they start from a much bigger base), stocks that barely trade, and any still near their 52-week low.</p>
          <p><b className="text-foreground">Step 2, the chart (45%).</b> Best 120 get a technical score: a stage 2 uptrend, closeness to the 1-year high, 6-month strength, rising volume, and how bad the worst fall was. Thin trading and big drawdowns are flagged.</p>
          <p><b className="text-foreground">Step 3, the business (55%).</b> The top 36 charts get a fundamental score: profit and sales growth, return on capital, low debt, promoter holding and whether the price is sensible for the growth. Losses, heavy debt and promoters selling cost points.</p>
          <p>Sources: prices and the market list from NSE&apos;s official MCP feed (mainboard and SME), charts from our market data, financials from public company pages on screener.in (cached a day, for personal learning; they can lag the latest results). Every number shown is read from those sources or computed from them, never estimated. The weights and cut-offs in the scores are our own rules of thumb, not proven predictors. Not advice.</p>
        </div>
      </details>
    </div>
  );
}
