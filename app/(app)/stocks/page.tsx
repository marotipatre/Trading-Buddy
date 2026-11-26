import { Suspense } from "react";
import { StocksBrowser } from "@/components/stocks/stocks-browser";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Stocks — Trading Buddy" };

export default function StocksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stocks</h1>
        <p className="text-sm text-muted-foreground">Browse about 750 NSE stocks by size and sector</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <StocksBrowser />
      </Suspense>
    </div>
  );
}
