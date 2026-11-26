import { fetchMoneycontrolCandles, toMoneycontrolSymbol } from "./moneycontrol";
import { createHistoryService } from "./history-service";
import { fetchCandles } from "./yahoo";

/**
 * Process-wide history service. Moneycontrol first for NSE equities (one request returns up to
 * 3000 adjusted bars and is rarely throttled); Yahoo for everything else and as the fallback.
 */
export const historyService = createHistoryService({
  providers: [
    { name: "moneycontrol", supports: (s) => toMoneycontrolSymbol(s) !== null, fetch: (s, i, f, t) => fetchMoneycontrolCandles(s, i, f, t) },
    { name: "yahoo", supports: () => true, fetch: fetchCandles },
  ],
});
