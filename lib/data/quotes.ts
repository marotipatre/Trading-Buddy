import { fetchGoogleQuote } from "./googlefinance";
import { fetchNseQuote } from "./nse-quote";
import { fetchUpstoxQuote } from "./upstox";
import { createQuoteService } from "./quote-service";
import { isMarketOpen } from "@/lib/market-hours";
import { fetchYahooQuote } from "./yahoo";

/** Process-wide quote service: Upstox, then Yahoo, then the Google Finance page, with caching and failover. */
export const quoteService = createQuoteService({
  providers: [
    // Upstox first: candles that match the exchange's own daily bars, for stocks AND indices, rarely throttled.
    { name: "upstox", fetch: (s) => fetchUpstoxQuote(s) },
    // NSE's own live feed (official, about a minute behind) covers every NSE stock including SME.
    { name: "nse", fetch: fetchNseQuote },
    { name: "yahoo", fetch: fetchYahooQuote },
    // Google is a scrape of a web page and prices stocks only, so it is the last resort.
    { name: "google", fetch: (s) => fetchGoogleQuote(s) },
  ],
  // Prices cannot change while the market is closed, so keep them much longer then.
  ttlMs: () => (isMarketOpen() ? 8_000 : 10 * 60_000),
  cooldownMs: 60_000,
});
