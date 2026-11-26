import Link from "next/link";
import { Suspense } from "react";
import { Workbench } from "@/components/backtest/workbench";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Backtest — Trading Buddy" };

export default function StrategiesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Backtest" description="Replay a strategy on years of history to see its win rate, its worst losing streak and whether its stop-loss really helps.">
        <Link href="/strategies/lab" className="rounded-[10px] border bg-card px-3.5 py-2 text-sm font-medium hover:bg-accent">Compare all strategies</Link>
      </PageHeader>
      <details className="group rounded-2xl border bg-card px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">How a backtest works</summary>
        <ol className="mt-3 grid gap-x-8 gap-y-2 text-muted-foreground sm:grid-cols-2">
          <li><b className="text-foreground">Pick a stock</b> and how many years to replay.</li>
          <li><b className="text-foreground">Describe the trade:</b> when to buy, the stop-loss and the target, or use a preset.</li>
          <li><b className="text-foreground">Run it.</b> The app takes every signal the strategy would have taken, filling at the next open, with Indian charges.</li>
          <li><b className="text-foreground">Read the result.</b> The chart marks each buy and exit. Then try Group to test many stocks: if it only works on one, it does not work.</li>
        </ol>
      </details>
      <Suspense><Workbench /></Suspense>
    </div>
  );
}
