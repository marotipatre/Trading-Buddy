import Link from "next/link";
import { Info } from "@/components/ui/info";
import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { graduation } from "@/lib/graduation";
import type { ClosedTrade } from "@/lib/paper/types";
import { cn } from "@/lib/utils";

/** The rule book's "do not skip stages" test, measured from your own journal. A discipline checklist, not a promise. */
export function GraduationCard({ trades, book = "swing" }: { trades: ClosedTrade[]; book?: "swing" | "intraday" }) {
  const g = graduation(trades);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">Ready for real money?<Info title="Ready for real money?"><p>{g.metCount} of {g.criteria.length} checks met. This is the <Link className="underline" href={`/playbook?book=${book}#path`}>stage path</Link> from the rule book, measured from your journal. Passing it does not mean you will profit; failing it means you are not ready.</p></Info></CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {g.criteria.map((c) => (
          <div key={c.label} className="space-y-1 rounded-lg border p-2.5 text-sm">
            <div className="flex items-center gap-2"><span className={cn("grid size-4 place-items-center rounded-full border", c.met ? "border-up bg-up text-background" : "text-transparent")}><Check className="size-3" /></span><span className="font-medium">{c.label}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>You: <b className="font-mono text-foreground">{c.have}</b></span><span>Goal: {c.need}</span></div>
            <div className="h-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", c.met ? "bg-up" : "bg-primary/60")} style={{ width: `${c.progress * 100}%` }} /></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
