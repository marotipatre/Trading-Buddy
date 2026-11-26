import { fetchMoneycontrolCandles, toMoneycontrolSymbol } from "./moneycontrol";
import { createHistoryService } from "./history-service";
import { fetchUpstoxCandles } from "./upstox";
import { fetchCandles } from "./yahoo";

/**
 * Process-wide history service, tried in this order:
 *  1. Upstox public candles: open (no login), NSE equities AND indices, 10 years of daily and years of 5m/15m.
 *  2. Moneycontrol: NSE equities, adjusted daily bars.
 *  3. Yahoo: everything else, and a last resort.
 * A source that fails is parked for a minute so the next request goes straight to a healthy one.
 */
export const historyService = createHistoryService({
  providers: [
    { name: "upstox", supports: (s) => /^\^/.test(s) || /\.NS$/i.test(s), fetch: (s, i, f, t) => fetchUpstoxCandles(s, i, f, t) },
    { name: "moneycontrol", supports: (s) => toMoneycontrolSymbol(s) !== null, fetch: (s, i, f, t) => fetchMoneycontrolCandles(s, i, f, t) },
    { name: "yahoo", supports: () => true, fetch: fetchCandles },
  ],
});
