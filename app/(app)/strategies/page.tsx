import { Workbench } from "@/components/backtest/workbench";

export const metadata = { title: "Backtest — Trading Buddy" };

export default function StrategiesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Backtest</h1>
        <p className="text-sm text-muted-foreground">Find out if a strategy would have worked, and whether its stop-loss really helps</p>
      </div>
      <Workbench />
    </div>
  );
}
