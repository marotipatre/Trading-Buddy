import { Suspense } from "react";
import { StocksBrowser } from "@/components/stocks/stocks-browser";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Stocks — Trading Buddy" };

export default function StocksPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Stocks" description="Every NSE stock. Click a column to sort, a row to trade."
        info={<><p>Prices and changes come from NSE&apos;s official market feed, a minute or two behind during the session.</p><p>Size classes follow NSE&apos;s Nifty 100 (large), Midcap 150, Smallcap 250 and Microcap 250 lists. &quot;Other listed&quot; is any other mainboard stock and &quot;SME&quot; is NSE&apos;s SME platform; both have no sector data.</p><p>Sort by <b>Traded today</b> to find the most active stocks.</p></>} />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <StocksBrowser />
      </Suspense>
    </div>
  );
}
