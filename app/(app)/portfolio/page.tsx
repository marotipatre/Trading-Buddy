import { PageHeader } from "@/components/ui/page-header";
import { Suspense } from "react";
import { PortfolioView } from "@/components/paper/portfolio-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Portfolio — Trading Buddy" };

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Portfolio" description="Your paper-trading holdings, positions, orders and funds" />
      <Suspense fallback={<div className="space-y-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-64 w-full" /></div>}>
        <PortfolioView />
      </Suspense>
    </div>
  );
}
