import { IntradayView } from "@/components/intraday/intraday-view";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Intraday — Trading Buddy" };

export default function IntradayPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Intraday desk" description="Today's picks, your 5x pot and daily limits."
        info={<>
          <p>Five liquid stocks for the next session, each with a buy-stop entry, a stop-loss and targets. Scan after the close, trade the next morning.</p>
          <p>Your <b>pot</b> is a separate paper account with 5x margin. Its profit and loss are tracked on their own and never mix with your main portfolio.</p>
          <p><b>Day trading on margin loses money for most people.</b> SEBI&apos;s own studies of Indian traders say so. Read the <a href="/playbook?book=intraday">intraday rule book</a> before you trade. Paper money only; picks are rule-based screens, not advice.</p>
        </>} />
      <IntradayView />
    </div>
  );
}
