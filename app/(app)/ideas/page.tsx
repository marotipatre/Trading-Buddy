import { PageHeader } from "@/components/ui/page-header";
import { IdeasView } from "@/components/ideas/ideas-view";

export const metadata = { title: "Ideas — Trading Buddy" };

export default function IdeasPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Ideas" description="Setups with entry, stop and target for the market you choose."
        info={<><p>Pick Nifty 50, Nifty 200 Momentum 30, Nifty 500 or every NSE stock that trades. Large caps are scanned first so results appear within seconds.</p><p>Your amount, days and target change the plan without a new scan. Rule-based screens from price trends, headlines and broker calls; not advice.</p></>} />
      <IdeasView />
    </div>
  );
}
