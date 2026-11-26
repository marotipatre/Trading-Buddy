import { PageHeader } from "@/components/ui/page-header";
import { IdeasView } from "@/components/ideas/ideas-view";

export const metadata = { title: "Ideas — Trading Buddy" };

export default function IdeasPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Ideas" description="Scan the index or market you choose: the strongest sectors, the best setups, and exactly where to enter, stop and take profit" />
      <IdeasView />
    </div>
  );
}
