import { PageHeader } from "@/components/ui/page-header";
import { StrategyLab } from "@/components/lab/strategy-lab";

export const metadata = { title: "Strategy lab — Trading Buddy" };

export default function LabPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Strategy lab" description="Every ready-made strategy on the same stocks." />
      <StrategyLab />
    </div>
  );
}
