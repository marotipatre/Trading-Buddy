import { Workbench } from "@/components/backtest/workbench";

export const metadata = { title: "Backtest — Trading Buddy" };

export default function StrategiesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Backtest</h1>
        <p className="text-sm text-muted-foreground">Find out if a strategy would have worked, and whether its stop-loss really helps</p>
      </div>
      <ol className="grid gap-2 text-sm sm:grid-cols-4">
        {[
          ["1", "Pick a stock", "and how many years of history to replay"],
          ["2", "Describe your trade", "Simple (EMA): when to buy, stop-loss, target. Or use a preset."],
          ["3", "Press Run backtest", "The app replays history and takes every signal it would have taken"],
          ["4", "Read the result", "Chart shows each buy and exit. Overview gives win chance and profit. Then try Group to test many stocks."],
        ].map(([n, t, d]) => (
          <li key={n} className="flex gap-2.5 rounded-lg border bg-card p-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{n}</span>
            <span><b className="block">{t}</b><span className="text-xs text-muted-foreground">{d}</span></span>
          </li>
        ))}
      </ol>
      <Workbench />
    </div>
  );
}
