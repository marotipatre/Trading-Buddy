import { IntradayView } from "@/components/intraday/intraday-view";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Intraday — Trading Buddy" };

export default function IntradayPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Intraday" description="Five picks for the next session, a separate 5x margin pot, and a scorecard that shows whether the picks actually work." />
      <IntradayView />
    </div>
  );
}
