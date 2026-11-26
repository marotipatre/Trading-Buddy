import { createSpacer } from "./spacer";
import type { Quote } from "./types";

/**
 * Live-quote fallback that reads the public Google Finance quote page.
 * - Used only when Yahoo is unavailable, spaced and cached, so request volume stays tiny.
 * - Google's terms discourage automated access; this is for low-volume personal use.
 * - It parses the page's embedded data (stable structure), not obfuscated CSS classes.
 *   If Google changes the page, parsing returns null and callers fall back / show stale data.
 */

const INDEX_MAP: Record<string, string> = {
  "^NSEI": "NIFTY_50:INDEXNSE",
  "^NSEBANK": "NIFTY_BANK:INDEXNSE",
  "^BSESN": "SENSEX:INDEXBOM",
  "^CNXIT": "NIFTY_IT:INDEXNSE",
  "^NSMIDCP": "NIFTY_NEXT_50:INDEXNSE",
  "^INDIAVIX": "INDIA_VIX:INDEXNSE",
};

/** Yahoo-style symbol -> Google Finance "TICKER:EXCHANGE", or null if unsupported. */
export function toGoogleSymbol(yahoo: string): string | null {
  const s = yahoo.trim().toUpperCase();
  if (INDEX_MAP[s]) return INDEX_MAP[s];
  let m = s.match(/^([A-Z0-9&_-]+)\.NS$/);
  if (m) return `${m[1].replace(/&/g, "%26")}:NSE`;
  m = s.match(/^([A-Z0-9&_-]+)\.BO$/);
  if (m) return `${m[1]}:BOM`;
  return null;
}

const NUM = "(-?\\d+(?:\\.\\d+)?(?:E-?\\d+)?)";

/** Extract a quote from the HTML of a Google Finance quote page. Pure; returns null if the shape is unknown. */
export function parseGoogleQuote(html: string, yahooSymbol: string): Quote | null {
  // Full block: ...,open,"/g/id",LOW,HIGH,PRICE,2,CHANGE,2,PCT,2,"CUR","TICKER:EXCH","Name",PREVCLOSE,...
  const full = html.match(
    new RegExp(`null,${NUM},"/[gm]/[^"]+",${NUM},${NUM},${NUM},\\d,${NUM},\\d,${NUM},\\d,"[A-Z]{3}","[^"]+","[^"]*",${NUM}`),
  );
  const time = html.match(/\[(\d{9,10})\],"Asia\/Calcutta"/);
  const t = time ? Number(time[1]) : Math.floor(Date.now() / 1000);
  if (full) {
    const [, , low, high, price, change, pct, prev] = full.map(Number);
    if ([low, high, price, change, pct, prev].every(Number.isFinite) && price > 0) {
      return { symbol: yahooSymbol, price, prevClose: prev, change, changePct: pct, dayHigh: high, dayLow: low, marketState: "", time: t };
    }
  }
  // Smaller tuple: "TICKER","EXCH"],"Name",0,"INR",[PRICE,CHANGE,PCT,...],null,PREVCLOSE
  const tuple = html.match(new RegExp(`\\["[^"]+","[A-Z]+"\\],"[^"]*",\\d,"[A-Z]{3}",\\[${NUM},${NUM},${NUM},[^\\]]*\\],null,${NUM}`));
  if (tuple) {
    const [, price, change, pct, prev] = tuple.map(Number);
    if ([price, change, pct, prev].every(Number.isFinite) && price > 0) {
      return { symbol: yahooSymbol, price, prevClose: prev, change, changePct: pct, dayHigh: price, dayLow: price, marketState: "", time: t };
    }
  }
  return null;
}

const spaced = createSpacer({ minGapMs: 800 });

export async function fetchGoogleQuote(yahooSymbol: string, fetchImpl: typeof fetch = fetch): Promise<Quote> {
  const g = toGoogleSymbol(yahooSymbol);
  if (!g) throw new Error(`${yahooSymbol}: not supported by the Google Finance fallback`);
  const html = await spaced(async () => {
    const res = await fetchImpl(`https://www.google.com/finance/quote/${g}?hl=en`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`Google Finance HTTP ${res.status}`);
    return res.text();
  });
  const q = parseGoogleQuote(html, yahooSymbol);
  if (!q) throw new Error(`${yahooSymbol}: could not read a price from Google Finance (page format may have changed)`);
  return { ...q, source: "google" };
}
