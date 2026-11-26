import { Suspense } from "react";
import { TradeView } from "./trade-view";

export default function TradePage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Loading…</div>}>
      <TradeView />
    </Suspense>
  );
}
