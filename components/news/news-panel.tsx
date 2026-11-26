"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AiSentimentToggle, useAi } from "@/components/ai-sentiment";
import { moodOf } from "@/lib/analysis/mood";
import { scoreHeadlines } from "@/lib/analysis/finbert";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalystCall, Consensus, NewsItem } from "@/lib/data/news";
import { cn } from "@/lib/utils";

const memo = new Map<string, { at: number; p: Payload }>();
interface Payload { news: NewsItem[]; calls: AnalystCall[]; summary: Consensus }
const ago = (t: number) => {
  const d = Math.max(0, Date.now() / 1000 - t);
  return d < 3600 ? `${Math.max(1, Math.round(d / 60))}m ago` : d < 86400 ? `${Math.round(d / 3600)}h ago` : `${Math.round(d / 86400)}d ago`;
};
const TONE = { buy: "bg-up/15 text-up", sell: "bg-down/15 text-down", hold: "bg-muted text-muted-foreground", unrated: "bg-muted text-muted-foreground" } as const;
const LABEL = { buy: "Buy", sell: "Sell", hold: "Hold", unrated: "Target" } as const;

/** Recent headlines and broker calls for a company. Calls are read from published headlines and each links to its article. */
export function NewsPanel({ name, price }: { name: string; price?: number }) {
  const [data, setData] = useState<{ name: string; p?: Payload; error?: string } | null>(null);
  const [tab, setTab] = useState<"calls" | "news">("calls");
  const ai = useAi();
  const [tones, setTones] = useState<{ key: string; scores: number[]; mood: number } | null>(null);
  const rounded = price ? Math.round(price) : undefined;

  useEffect(() => {
    const hit = memo.get(`${name}|${rounded ?? ""}`);
    if (hit && Date.now() - hit.at < 10 * 60_000) { /* eslint-disable-next-line react-hooks/set-state-in-effect -- show the remembered result at once */
      setData({ name, p: hit.p }); return; }
    const ctl = new AbortController();
    fetch(`/api/news?name=${encodeURIComponent(name)}${rounded ? `&price=${rounded}` : ""}`, { signal: ctl.signal })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "failed"); memo.set(`${name}|${rounded ?? ""}`, { at: Date.now(), p: j }); setData({ name, p: j }); })
      .catch((e: Error) => { if (e.name !== "AbortError") setData({ name, error: e.message }); });
    return () => ctl.abort();
  }, [name, rounded]);

  const d = data?.name === name ? data : null;
  const newsKey = `${name}|${d?.p?.news.length ?? 0}|${ai.status}`;
  useEffect(() => {
    const items = d?.p?.news;
    if (ai.status !== "ready" || !items?.length) return;
    let live = true;
    (async () => {
      const [scores, mood] = await Promise.all([scoreHeadlines(items.map((n) => n.title)), moodOf(items)]);
      if (live && scores) setTones({ key: newsKey, scores, mood: mood.score });
    })();
    return () => { live = false; };
  }, [d, ai.status, newsKey]);
  const aiTone = tones?.key === newsKey ? tones : null;
  const s = d?.p?.summary;
  return (
    <Card>
      <CardHeader>
        <CardTitle>News &amp; broker calls</CardTitle>
        <CardDescription>Headlines from the last two weeks. Broker calls are read from published headlines (Jefferies, ICICI Securities, HDFC Securities, Motilal Oswal and others): open the article to confirm before relying on one.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <AiSentimentToggle />
        {aiTone && <p className="text-xs">AI reading of recent headlines: <b className={aiTone.mood > 0.15 ? "text-up" : aiTone.mood < -0.15 ? "text-down" : ""}>{aiTone.mood > 0.15 ? "positive" : aiTone.mood < -0.15 ? "negative" : "mixed"}</b> ({aiTone.mood >= 0 ? "+" : ""}{aiTone.mood.toFixed(2)})</p>}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist">
          {([["calls", `Broker calls${s ? ` (${s.brokers})` : ""}`], ["news", `News${d?.p ? ` (${d.p.news.length})` : ""}`]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={cn("rounded-md px-3 py-1.5 text-sm font-medium", tab === id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>
          ))}
        </div>
        {!d && <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>}
        {d?.error && <p className="text-sm text-muted-foreground">{d.error}</p>}
        {d?.p && tab === "calls" && (
          <>
            {s && s.brokers > 0 ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted/50 p-2.5 text-sm">
                <span><b className="text-up">{s.buy}</b> buy · <b>{s.hold}</b> hold · <b className="text-down">{s.sell}</b> sell</span>
                {s.medianTarget && <span>Median target <b className="font-mono">₹{s.medianTarget.toLocaleString("en-IN")}</b>{s.upsidePct !== undefined && <span className={s.upsidePct >= 0 ? "text-up" : "text-down"}> ({s.upsidePct >= 0 ? "+" : ""}{s.upsidePct.toFixed(1)}% from price)</span>}</span>}
                <span className="text-xs text-muted-foreground">latest call per broker, last 4 months</span>
              </div>
            ) : <p className="text-sm text-muted-foreground">No broker calls found in recent headlines for this company. That does not mean none exist; many are not published in headlines.</p>}
            <ul className="divide-y">
              {d.p.calls.map((c) => (
                <li key={c.link} className="flex items-start gap-3 py-2.5">
                  <span className={cn("mt-0.5 w-14 shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs font-semibold", TONE[c.rating])}>{LABEL[c.rating]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-sm"><b>{c.broker}</b>{c.target && <span className="font-mono">target ₹{c.target.toLocaleString("en-IN")}</span>}<span className="text-xs text-muted-foreground">{ago(c.time)}</span></div>
                    <a href={c.link} target="_blank" rel="noreferrer noopener" className="line-clamp-2 text-xs text-muted-foreground hover:text-foreground">{c.title} · {c.source} <ExternalLink className="inline size-3" /></a>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        {d?.p && tab === "news" && (
          <ul className="divide-y">
            {d.p.news.length === 0 && <li className="py-3 text-sm text-muted-foreground">No recent headlines found.</li>}
            {d.p.news.map((n, i) => (
              <li key={n.link} className="py-2.5">
                {aiTone && <span className={cn("mr-1.5 inline-block size-2 rounded-full", aiTone.scores[i] > 0.2 ? "bg-up" : aiTone.scores[i] < -0.2 ? "bg-down" : "bg-muted-foreground/40")} title={`AI tone ${aiTone.scores[i]?.toFixed(2)}`} />}
                <a href={n.link} target="_blank" rel="noreferrer noopener" className="text-sm hover:underline">{n.title}</a>
                <div className="text-xs text-muted-foreground">{n.source} · {ago(n.time)}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
