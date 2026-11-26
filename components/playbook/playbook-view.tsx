"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BOOKS, type Book } from "@/lib/playbook/content";
import { cn } from "@/lib/utils";

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
      <p className="text-xs text-muted-foreground">These rule books summarise ideas widely taught by professional traders and the books listed, in my own words, with nothing copied. Percentages marked as conventions are common practice, not guarantees. This is education, not investment advice.</p>
    </div>
  );
}

function BookView({ book }: { book: Book }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const all = book.checklist.every((_, i) => done[i]);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{book.title}</h2>
        <p className="text-sm text-muted-foreground">{book.tagline}</p>
      </div>
      <Card>
        <CardHeader><CardTitle>What the evidence says</CardTitle></CardHeader>
        <CardContent><ul className="list-disc space-y-1.5 pl-5 text-sm">{book.facts.map((f) => <li key={f.text}>{f.text}{f.href && <> <a className="inline-flex items-center gap-0.5 underline" href={f.href} target="_blank" rel="noreferrer noopener">source <ExternalLink className="size-3" /></a></>}</li>)}</ul></CardContent>
      </Card>

      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle>Before every trade: checklist</CardTitle>
          <CardDescription>If you cannot tick every line, do not take the trade.</CardDescription>
        </CardHeader>
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

      {book.sections.map((s) => (
        <Card key={s.title}>
          <CardHeader><CardTitle>{s.title}</CardTitle>{s.intro && <CardDescription>{s.intro}</CardDescription>}</CardHeader>
          <CardContent className="divide-y">
            {s.rules.map((r) => (
              <div key={r.rule} className="space-y-1 py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium">{r.rule}</p>
                <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground/80">Why: </span>{r.why}</p>
                {r.inApp && <Link href={r.inApp.href} className="inline-block text-xs text-primary underline">{r.inApp.label}</Link>}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>A routine to follow</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {book.routine.map((r) => <div key={r.when} className="flex gap-3 text-sm"><span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">{r.when}</span><span>{r.what}</span></div>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Common mistakes and the fix</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {book.mistakes.map((m) => <div key={m.mistake} className="text-sm"><b>{m.mistake}.</b> <span className="text-muted-foreground">{m.fix}</span></div>)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Reading list</CardTitle><CardDescription>Where these ideas come from. Read the originals.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {book.reading.map((b) => <div key={b.title} className="text-sm"><b>{b.title}</b> <span className="text-muted-foreground">by {b.author}</span><div className="text-xs text-muted-foreground">{b.why}</div></div>)}
        </CardContent>
      </Card>
    </div>
  );
}
