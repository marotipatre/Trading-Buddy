"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Briefcase, Zap } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";
import { ChangePill } from "@/components/change-pill";
import { SymbolLabel } from "@/components/symbol-label";
import { fmtInr, fmtPct } from "@/lib/format";
import { positionStats } from "@/lib/paper/portfolio";
import { displaySymbol } from "@/lib/symbols";
import { ExitEditor } from "./exit-editor";
import { usePaper } from "./paper-provider";
import { useNow } from "@/components/use-now";

/** Open positions of one product as broker-style rows: qty and average, market price, returns, current value. */
export function HoldingRows({ product, empty }: { product: "delivery" | "intraday"; empty: string }) {
  const { state, quotes, closeNow } = usePaper();
  const rows = state.positions.filter((p) => p.product === product);
  const [editing, setEditing] = useState<number | null>(null);
  const now = useNow();
  if (!rows.length) return (
    <EmptyState icon={product === "delivery" ? Briefcase : Zap} title={product === "delivery" ? "No holdings yet" : "No open intraday positions"} text={empty}
      actions={product === "delivery" ? [{ label: "Find swing ideas", href: "/ideas", primary: true }, { label: "Browse stocks", href: "/stocks" }] : [{ label: "Today's intraday picks", href: "/intraday", primary: true }, { label: "Read the intraday rules", href: "/playbook?book=intraday" }]} />
  );
  return (
    <Card className="py-0">
      {rows.map((p) => {
        const q = quotes[p.symbol];
        const ltp = q?.price ?? p.entryPrice;
        const st = positionStats(p, ltp, q?.prevClose, now);
        const up = st.pnl >= 0;
        return (
          <Fragment key={p.id}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 border-b px-4 py-3.5 last:border-b-0 sm:grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr_auto] sm:items-center">
            <Link href={`/trade?symbol=${encodeURIComponent(p.symbol)}`} className="min-w-0">
              <SymbolLabel symbol={p.symbol} />
              <div className="mt-1 text-xs text-muted-foreground">
                {p.qty} {p.qty === 1 ? "share" : "shares"} · Avg {p.entryPrice.toFixed(2)}
                {p.direction === "short" && <span className="ml-1 text-down">· short</span>}
              </div>
            </Link>
            <div className="text-right sm:text-left">
              <div className="tabular font-mono text-sm font-semibold">{ltp.toFixed(2)}</div>
              <ChangePill pct={q?.changePct} />
            </div>
            <div className="text-left sm:text-left">
              <div className="text-[11px] text-muted-foreground sm:hidden">Returns</div>
              <div className={`tabular font-mono text-sm font-semibold ${up ? "text-up" : "text-down"}`}>{fmtInr(st.pnl, { sign: true })}</div>
              <div className={`tabular font-mono text-xs ${up ? "text-up" : "text-down"}`}>{fmtPct(st.pnlPct, 2, { sign: true })}</div>
            </div>
            <div className="text-right sm:text-left">
              <div className="text-[11px] text-muted-foreground sm:hidden">Current</div>
              <div className="tabular font-mono text-sm">{fmtInr(st.current)}</div>
              <div className="tabular font-mono text-xs text-muted-foreground">Inv. {fmtInr(st.invested)}</div>
              {(p.stop || p.target) && (
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {p.stop ? <>SL <span className="font-mono">{p.stop.toFixed(2)}</span>{p.trailDist ? "↑" : ""}</> : null}
                  {p.stop && p.target ? " · " : null}
                  {p.target ? <>TP <span className="font-mono">{p.target.toFixed(2)}</span></> : null}
                </div>
              )}
            </div>
            <div className="col-span-2 flex justify-end gap-2 sm:col-span-1">
              <Button size="sm" variant="outline" onClick={() => setEditing(editing === p.id ? null : p.id)}>Exits</Button>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/trade?symbol=${encodeURIComponent(p.symbol)}&side=buy`} />}>Add</Button>
              <Button size="sm" variant="outline" className="border-down/50 text-down hover:bg-down/10" onClick={async () => {
                const r = await closeNow(p.id);
                if (r.error) toast.error(r.error); else toast.success(`Closed ${displaySymbol(p.symbol)}`);
              }}>Exit</Button>
            </div>
          </div>
          {editing === p.id && <ExitEditor position={p} ltp={ltp} onDone={() => setEditing(null)} />}
          </Fragment>
        );
      })}
    </Card>
  );
}
