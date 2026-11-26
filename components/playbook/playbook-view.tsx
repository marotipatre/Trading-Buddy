"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BOOKS, type Book } from "@/lib/playbook/content";
import { cn } from "@/lib/utils";
import { Calculators } from "./calculators";
import { markDone } from "@/lib/progress";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function PlaybookView() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("book") === "intraday" ? "intraday" : "swing";
  const book = BOOKS.find((b) => b.id === id)!;
  return (
    <div className="space-y-6">
      <div className="grid max-w-md grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Rule book">
        {BOOKS.map((b) => (
          <button key={b.id} type="button" role="tab" aria-selected={b.id === id} onClick={() => router.replace(`/playbook?book=${b.id}`, { scroll: false })}
            className={cn("rounded-md px-3 py-1.5 text-sm font-medium", b.id === id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>{b.id === "swing" ? "Swing trading" : "Intraday"}</button>
        ))}
      </div>
      <BookView key={book.id} book={book} />
      <p className="text-xs text-muted-foreground">These rule books summarise ideas widely taught by professional traders and the books listed, in my own words, with nothing copied. Percentages marked as conventions are common practice, not guarantees. Tax, margin and exchange rules change: confirm current figures with your broker. This is education, not investment advice.</p>
    </div>
  );
}

function BookView({ book }: { book: Book }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  useEffect(() => { if (book.id === "swing") markDone("rules"); }, [book.id]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");
  const needle = q.trim().toLowerCase();
  const match = (t: string) => !needle || t.toLowerCase().includes(needle);
  const prefix = book.id === "swing" ? "S" : "I";
  const all = book.checklist.every((_, i) => done[i]);

  // The side table of contents: every block on the page, in order.
  const nav = useMemo(() => [
    { id: "constitution", label: "The pledge" },
    { id: "checklist", label: "Before every trade" },
    { id: "path", label: "Your path" },
    ...book.sections.map((s, i) => ({ id: slug(s.title), label: s.title.replace(/^\d+\.\s*/, ""), n: i + 1 })),
    { id: "setups", label: "Setups" },
    { id: "tables", label: "Numbers to know" },
    { id: "calculators", label: "Calculators" },
    { id: "scorecard", label: "Monthly scorecard" },
    { id: "routine", label: "Daily routine" },
    { id: "mistakes", label: "Mistakes and fixes" },
    { id: "reading", label: "Reading list" },
  ], [book]);

  useEffect(() => {
    const els = nav.map((n) => document.getElementById(n.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.id);
    }, { rootMargin: "-90px 0px -65% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [nav, needle]);

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const total = book.sections.reduce((n, s) => n + s.rules.length, 0);

  return (
    <div className="grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <label className="lg:hidden"><span className="sr-only">Jump to a section</span>
          <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={active} onChange={(e) => jump(e.target.value)}>
            <option value="">Jump to…</option>
            {nav.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
        </label>
        <nav aria-label="On this page" className="hidden max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 lg:block">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">On this page</div>
          <ul className="space-y-0.5 border-l">
            {nav.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => jump(n.id)} aria-current={active === n.id ? "true" : undefined}
                  className={cn("-ml-px block w-full border-l-2 py-1 pl-3 pr-1 text-left text-[13px] leading-snug transition-colors", active === n.id ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {"n" in n && <span className="mr-1.5 font-mono text-[11px] opacity-60">{prefix}{(n as { n: number }).n}</span>}{n.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">{book.title}</h2>
          <p className="text-sm text-muted-foreground">{book.tagline} <span className="whitespace-nowrap">{total} rules in {book.sections.length} sections.</span></p>
        </div>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search every ${book.id === "swing" ? "swing" : "intraday"} rule (stop, margin, VWAP, tilt…)`}
          className="h-10 w-full max-w-xl rounded-lg border bg-background px-3 text-sm" aria-label="Search rules" />

        {!needle && (
          <>
            <Card id="constitution" className="scroll-mt-24 border-primary/40">
              <CardHeader><CardTitle>The pledge</CardTitle><CardDescription>Read it before every session. If you cannot agree with a line, do not trade today.</CardDescription></CardHeader>
              <CardContent><ol className="list-decimal space-y-1.5 pl-5 text-sm">{book.constitution.map((c) => <li key={c}>{c}</li>)}</ol></CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>What the evidence says</CardTitle></CardHeader>
              <CardContent><ul className="list-disc space-y-1.5 pl-5 text-sm">{book.facts.map((f) => <li key={f.text}>{f.text}{f.href && <> <a className="inline-flex items-center gap-0.5 underline" href={f.href} target="_blank" rel="noreferrer noopener">source <ExternalLink className="size-3" /></a></>}</li>)}</ul></CardContent>
            </Card>

            <Card id="checklist" className="scroll-mt-24">
              <CardHeader><CardTitle>Before every trade: checklist</CardTitle><CardDescription>If you cannot tick every line, do not take the trade.</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {book.checklist.map((c, i) => (
                  <label key={c} className="flex cursor-pointer items-start gap-2.5 text-sm">
                    <input type="checkbox" className="mt-1" checked={!!done[i]} onChange={(e) => setDone({ ...done, [i]: e.target.checked })} />
                    <span className={cn(done[i] && "text-muted-foreground line-through")}>{c}</span>
                  </label>
                ))}
                <p className={cn("flex items-center gap-1.5 pt-1 text-sm font-medium", all ? "text-up" : "text-muted-foreground")}>{all ? <><Check className="size-4" /> All clear. Trade the plan.</> : "Not yet."}</p>
              </CardContent>
            </Card>

            <Card id="path" className="scroll-mt-24">
              <CardHeader><CardTitle>Your path: do not skip stages</CardTitle><CardDescription>Move to the next stage only when you pass the one you are on.</CardDescription></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {book.stages.map((st) => <div key={st.stage} className="space-y-0.5 rounded-lg border p-3 text-sm"><b>{st.stage}</b><p className="text-muted-foreground">{st.do}</p><p><span className="font-medium">Pass when: </span><span className="text-muted-foreground">{st.passWhen}</span></p></div>)}
              </CardContent>
            </Card>
          </>
        )}

        {book.sections.map((s, si) => {
          const rules = s.rules.map((r, ri) => ({ r, code: `${prefix}${si + 1}.${ri + 1}` })).filter(({ r }) => match(r.rule) || match(r.why) || match(s.title));
          if (!rules.length) return null;
          return (
            <Card key={s.title} id={slug(s.title)} className="scroll-mt-24">
              <CardHeader><CardTitle>{s.title}</CardTitle>{s.intro && <CardDescription>{s.intro}</CardDescription>}</CardHeader>
              <CardContent className="divide-y">
                {rules.map(({ r, code }) => (
                  <div key={r.rule} className="space-y-1 py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium"><span className="mr-2 font-mono text-[11px] font-normal text-muted-foreground">{code}</span>{r.rule}</p>
                    <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground/80">Why: </span>{r.why}</p>
                    {r.inApp && <Link href={r.inApp.href} className="inline-block text-xs text-primary underline">{r.inApp.label}</Link>}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}

        {!needle && (
          <>
            <Card id="setups" className="scroll-mt-24">
              <CardHeader><CardTitle>Setups: exact entry, stop and target</CardTitle><CardDescription>Master one or two. Each needs a plan before you click buy.</CardDescription></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {book.setups.map((st) => (
                  <div key={st.name} className="space-y-1 rounded-lg border p-3 text-sm">
                    <b>{st.name}</b>
                    <p><span className="font-medium">When: </span><span className="text-muted-foreground">{st.when}</span></p>
                    <p><span className="font-medium">Entry: </span><span className="text-muted-foreground">{st.entry}</span></p>
                    <p><span className="font-medium text-down">Stop: </span><span className="text-muted-foreground">{st.stop}</span></p>
                    <p><span className="font-medium text-up">Target: </span><span className="text-muted-foreground">{st.target}</span></p>
                    <p><span className="font-medium">Avoid: </span><span className="text-muted-foreground">{st.avoid}</span></p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div id="tables" className="grid scroll-mt-24 gap-6 lg:grid-cols-2">
              {book.tables.map((t) => (
                <Card key={t.title}>
                  <CardHeader><CardTitle>{t.title}</CardTitle>{t.note && <CardDescription>{t.note}</CardDescription>}</CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-muted-foreground"><tr>{t.head.map((h) => <th key={h} className="py-1 pr-3 font-medium">{h}</th>)}</tr></thead>
                      <tbody className="divide-y">{t.rows.map((r) => <tr key={r.join("|")}>{r.map((c, i) => <td key={i} className="py-1.5 pr-3 font-mono text-xs">{c}</td>)}</tr>)}</tbody>
                    </table>
                  </CardContent>
                </Card>
              ))}
            </div>

            <section id="calculators" className="scroll-mt-24 space-y-3">
              <h3 className="text-base font-semibold">Calculators</h3>
              <Calculators intraday={book.id === "intraday"} />
            </section>

            <Card id="scorecard" className="scroll-mt-24">
              <CardHeader><CardTitle>Your monthly scorecard</CardTitle><CardDescription>Track these every month. What gets measured gets better.</CardDescription></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1 pr-3 font-medium">Metric</th><th className="pr-3 font-medium">How</th><th className="font-medium">Good looks like</th></tr></thead>
                  <tbody className="divide-y">{book.scorecard.map((m) => <tr key={m.metric}><td className="py-1.5 pr-3 font-medium">{m.metric}</td><td className="pr-3 text-muted-foreground">{m.how}</td><td className="text-muted-foreground">{m.target}</td></tr>)}</tbody>
                </table>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card id="routine" className="scroll-mt-24">
                <CardHeader><CardTitle>A routine to follow</CardTitle></CardHeader>
                <CardContent className="space-y-2.5">{book.routine.map((r) => <div key={r.when} className="flex gap-3 text-sm"><span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">{r.when}</span><span>{r.what}</span></div>)}</CardContent>
              </Card>
              <Card id="mistakes" className="scroll-mt-24">
                <CardHeader><CardTitle>Common mistakes and the fix</CardTitle></CardHeader>
                <CardContent className="space-y-2.5">{book.mistakes.map((m) => <div key={m.mistake} className="text-sm"><b>{m.mistake}.</b> <span className="text-muted-foreground">{m.fix}</span></div>)}</CardContent>
              </Card>
            </div>

            <Card id="reading" className="scroll-mt-24">
              <CardHeader><CardTitle>Reading list</CardTitle><CardDescription>Where these ideas come from. Read the originals.</CardDescription></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">{book.reading.map((b) => <div key={b.title} className="text-sm"><b>{b.title}</b> <span className="text-muted-foreground">by {b.author}</span><div className="text-xs text-muted-foreground">{b.why}</div></div>)}</CardContent>
            </Card>
          </>
        )}
        {needle && <p className="text-xs text-muted-foreground">Showing rules that match &ldquo;{q}&rdquo;. Clear the search to see the whole book.</p>}
      </div>
    </div>
  );
}
