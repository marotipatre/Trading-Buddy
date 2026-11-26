import { StrategyLab } from "@/components/lab/strategy-lab";

export const metadata = { title: "Strategy lab — Trading Buddy" };

export default function LabPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Strategy lab</h1>
        <p className="text-sm text-muted-foreground">Compare every ready-made strategy on the same stocks and see which ones actually held up</p>
      </div>
      <StrategyLab />
    </div>
  );
}
