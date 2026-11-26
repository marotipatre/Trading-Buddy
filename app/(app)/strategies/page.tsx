import Link from "next/link";
import { Suspense } from "react";
import { Workbench } from "@/components/backtest/workbench";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Backtest — Trading Buddy" };

export default function StrategiesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Backtest" description="Replay a strategy on history and see if it holds up."
        info={<><p><b>Pick a stock</b> and how many years to replay, then <b>describe the trade</b>: when to buy, the stop-loss and the target, or use a preset.</p><p>The app takes every signal the strategy would have taken, filling at the next open, with Indian charges. The chart marks each buy and exit.</p><p>Then try <b>Group</b> to test many stocks: if it only works on one, it does not work.</p></>}>
        <Link href="/strategies/lab" className="rounded-[10px] border bg-card px-3.5 py-2 text-sm font-medium hover:bg-accent">Compare all strategies</Link>
      </PageHeader>
      <Suspense><Workbench /></Suspense>
    </div>
  );
}
