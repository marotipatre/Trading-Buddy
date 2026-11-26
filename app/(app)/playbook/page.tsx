import { PageHeader } from "@/components/ui/page-header";
import { Suspense } from "react";
import { PlaybookView } from "@/components/playbook/playbook-view";

export const metadata = { title: "Rule books — Trading Buddy" };

export default function PlaybookPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Rule books" description="Two sets of rules used by full-time traders to control risk and avoid psychological mistakes: one for swing trading, one for intraday" />
      <Suspense><PlaybookView /></Suspense>
    </div>
  );
}
