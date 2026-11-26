import { fetchGoogleQuote } from "./googlefinance";
import { createQuoteService } from "./quote-service";
import { fetchYahooQuote } from "./yahoo";

/** Process-wide quote service: Yahoo first, Google Finance page as the fallback. */
export const quoteService = createQuoteService({
  providers: [
    { name: "yahoo", fetch: fetchYahooQuote },
    { name: "google", fetch: (s) => fetchGoogleQuote(s) },
  ],
  ttlMs: 8000,
  cooldownMs: 60_000,
});
