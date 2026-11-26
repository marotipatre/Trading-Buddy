import { Suspense } from "react";
import { PlaybookView } from "@/components/playbook/playbook-view";

export const metadata = { title: "Rule books — Trading Buddy" };

export default function PlaybookPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Rule books</h1>
        <p className="text-sm text-muted-foreground">Two sets of rules used by full-time traders to control risk and avoid psychological mistakes: one for swing trading, one for intraday</p>
      </div>
      <Suspense><PlaybookView /></Suspense>
    </div>
  );
}
