import { fetchGoogleQuote } from "./googlefinance";
import { createQuoteService } from "./quote-service";
import { isMarketOpen } from "@/lib/market-hours";
import { fetchYahooQuote } from "./yahoo";

/** Process-wide quote service: Yahoo first, Google Finance page as the fallback. */
export const quoteService = createQuoteService({
  providers: [
    { name: "yahoo", fetch: fetchYahooQuote },
    { name: "google", fetch: (s) => fetchGoogleQuote(s) },
  ],
  // Prices cannot change while the market is closed, so keep them much longer then.
  ttlMs: () => (isMarketOpen() ? 8_000 : 10 * 60_000),
  cooldownMs: 60_000,
});
