"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, fmtInr, fmtNum, fmtPct } from "@/lib/format";
import { normalizeTags, PRESET_TAGS } from "@/lib/paper/journal";
import type { ClosedTrade } from "@/lib/paper/types";
import { cn } from "@/lib/utils";
import { usePaper } from "./paper-provider";

function Editor({ trade, onSave }: { trade: ClosedTrade; onSave: (patch: { note: string; tags: string[] }) => void }) {
  const [note, setNote] = useState(trade.note ?? "");
  const [tags, setTags] = useState<string[]>(trade.tags ?? []);
  const [custom, setCustom] = useState("");
  const toggle = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : normalizeTags([...cur, t])));
  return (
    <div className="space-y-3 bg-muted/30 p-4">
      <div className="flex flex-wrap gap-1.5">
        {[...PRESET_TAGS, ...tags.filter((t) => !(PRESET_TAGS as readonly string[]).includes(t))].map((t) => (
          <button key={t} type="button" onClick={() => toggle(t)}
            className={cn("rounded-full border px-2.5 py-0.5 text-xs transition-colors", tags.includes(t) ? "border-primary bg-primary/20 text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t}
          </button>
        ))}
        <Input className="h-6 w-36 text-xs" placeholder="Add custom tag…" value={custom} onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { e.preventDefault(); setTags(normalizeTags([...tags, custom])); setCustom(""); } }} />
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3}
        placeholder="Why did you enter? What did you see? What would you do differently?"
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" />
      <Button size="sm" onClick={() => onSave({ note, tags })}>Save note</Button>
    </div>
  );
}

export function JournalTable() {
  const { state, annotate } = usePaper();
  const [open, setOpen] = useState<number | null>(null);
  const rows = [...state.trades].reverse();
  return (
    <Card className="py-0">
      <CardHeader className="pt-4"><CardTitle>Trade journal ({rows.length})</CardTitle></CardHeader>
      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">Closed trades appear here. Click a row to add notes and tags; the insights panel learns from them.</p>
      ) : (
        <ScrollArea className="max-h-[32rem]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 pl-3" />
                <TableHead>Closed</TableHead><TableHead>Symbol</TableHead>
                <TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Entry</TableHead><TableHead className="text-right">Exit</TableHead>
                <TableHead className="text-right">R</TableHead><TableHead className="text-right">Dip / Run</TableHead>
                <TableHead className="text-right">Net P&amp;L</TableHead><TableHead className="pr-4">Why / tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <Fragment key={t.id}>
                  <TableRow className="cursor-pointer" onClick={() => setOpen(open === t.id ? null : t.id)}>
                    <TableCell className="pl-3 text-muted-foreground">{open === t.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</TableCell>
                    <TableCell className="text-xs">{fmtDate(t.exitTime)}</TableCell>
                    <TableCell className="font-medium">{t.symbol}</TableCell>
                    <TableCell className="text-right font-mono">{t.qty}</TableCell>
                    <TableCell className="text-right font-mono">{t.entryPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">{t.exitPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">{t.rMultiple !== undefined ? fmtNum(t.rMultiple, 2) : "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {t.maePct !== undefined ? `-${t.maePct.toFixed(1)}% / +${(t.mfePct ?? 0).toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${t.netPnl >= 0 ? "text-up" : "text-down"}`}>
                      {fmtInr(t.netPnl, { sign: true })}<div className="text-[11px]">{fmtPct(t.returnPct, 2, { sign: true })}</div>
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="outline">{t.reason}</Badge>
                        {t.tags?.map((g) => <Badge key={g} variant="secondary">{g}</Badge>)}
                        {t.note && <StickyNote className="size-3.5 text-muted-foreground" aria-label="Has a note" />}
                      </div>
                    </TableCell>
                  </TableRow>
                  {open === t.id && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={10} className="p-0">
                        <Editor trade={t} onSave={(patch) => { annotate(t.id, patch); setOpen(null); }} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </Card>
  );
}
