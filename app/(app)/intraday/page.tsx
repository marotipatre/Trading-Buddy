import { IntradayView } from "@/components/intraday/intraday-view";

export const metadata = { title: "Intraday — Trading Buddy" };

export default function IntradayPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Intraday</h1>
        <p className="text-sm text-muted-foreground">Five picks for the next session, a separate 5x margin pot, and a scorecard that shows whether the picks work</p>
      </div>
      <IntradayView />
    </div>
  );
}
