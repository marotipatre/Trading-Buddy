import { Suspense } from "react";
import { StocksBrowser } from "@/components/stocks/stocks-browser";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Stocks — Trading Buddy" };

export default function StocksPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Stocks" description="Every stock listed on NSE in one table. Sort by today's move, the 30-day move or how much traded, and open any row to chart it and paper trade." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <StocksBrowser />
      </Suspense>
    </div>
  );
}
