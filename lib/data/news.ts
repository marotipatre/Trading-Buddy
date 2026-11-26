/**
 * Company news and broker calls from Google News RSS (free, no key; meant for personal use).
 *
 * Broker calls are NOT an official ratings feed. They are read out of published headlines such as
 * "Jefferies keeps Buy on Reliance, target Rs 1,700", so every call links back to the article it came from.
 */

export interface NewsItem { title: string; source: string; link: string; time: number }
export type Rating = "buy" | "hold" | "sell" | "unrated";
export interface AnalystCall extends NewsItem { broker: string; rating: Rating; target?: number }

export const BROKERS: [string, RegExp][] = [
  ["Jefferies", /jefferies/i], ["ICICI Securities", /icici\s*sec(?:urities)?|icici\s*direct/i], ["HDFC Securities", /hdfc\s*sec(?:urities)?/i],
  ["Motilal Oswal", /motilal/i], ["Kotak Securities", /kotak\s*(?:institutional|sec|equities)/i], ["Nomura", /nomura/i],
  ["Goldman Sachs", /goldman/i], ["Morgan Stanley", /morgan\s*stanley/i], ["CLSA", /\bclsa\b/i], ["Citi", /\bciti(?:group)?\b/i],
  ["JM Financial", /jm\s*financial/i], ["Axis Securities", /axis\s*(?:sec|capital)/i], ["Emkay", /emkay/i], ["Nuvama", /nuvama/i],
  ["Antique", /antique\s*stock/i], ["Prabhudas Lilladher", /prabhudas|\bPL\s*capital/i], ["Sharekhan", /sharekhan/i], ["Anand Rathi", /anand\s*rathi/i],
  ["Macquarie", /macquarie/i], ["UBS", /\bubs\b/i], ["BofA Securities", /\bbofa\b|bank\s*of\s*america/i], ["Bernstein", /bernstein/i],
  ["Systematix", /systematix/i], ["Elara", /elara/i], ["Choice Broking", /choice\s*broking/i], ["SBI Securities", /sbi\s*sec/i],
  ["Edelweiss", /edelweiss/i], ["IIFL", /\biifl\b/i], ["Geojit", /geojit/i], ["Religare Broking", /religare/i], ["Ventura", /ventura\s*sec/i],
  ["Dolat Capital", /dolat/i], ["Equirus", /equirus/i], ["Ambit", /\bambit\b/i], ["Investec", /investec/i], ["HSBC", /\bhsbc\b/i], ["Barclays", /barclays/i],
];

const BUY = /\b(buy|accumulate|add|outperform|overweight|positive|bullish|upgrade[sd]?\s+to\s+(?:buy|add|outperform|overweight))\b/i;
const SELL = /\b(sell|reduce|underperform|underweight|negative|bearish|downgrade[sd]?\s+to\s+(?:sell|reduce|underperform|underweight))\b/i;
const HOLD = /\b(hold|neutral|equal[- ]?weight|market\s*perform|in-?line|sector\s*perform)\b/i;
const TARGET = /(?:target(?:\s*price)?|\bTP\b|\bPT\b)\s*(?:of|at|to|:|-)?\s*(?:rs\.?|₹|inr)?\s*([\d][\d,]*(?:\.\d+)?)/i;

const decode = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const tag = (block: string, name: string) => decode(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "");

export function parseFeed(xml: string): NewsItem[] {
  const out: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const raw = tag(m[1], "title");
    const source = tag(m[1], "source");
    const title = source && raw.endsWith(` - ${source}`) ? raw.slice(0, -(source.length + 3)) : raw;
    const time = Date.parse(tag(m[1], "pubDate"));
    const link = tag(m[1], "link");
    if (title && link && Number.isFinite(time)) out.push({ title, source: source || "News", link, time: Math.floor(time / 1000) });
  }
  return out;
}

/** A broker call in a headline: needs a known broker and a rating word or a target price. Otherwise it is just news. */
export function parseCall(item: NewsItem): AnalystCall | null {
  const broker = BROKERS.find(([, re]) => re.test(item.title))?.[0];
  if (!broker) return null;
  const t = item.title.match(TARGET)?.[1]?.replace(/,/g, "");
  const target = t ? Number(t) : undefined;
  const rating: Rating = SELL.test(item.title) ? "sell" : BUY.test(item.title) ? "buy" : HOLD.test(item.title) ? "hold" : "unrated";
  if (rating === "unrated" && target === undefined) return null;
  return { ...item, broker, rating, ...(target && target > 0 ? { target } : {}) };
}

export interface Consensus { buy: number; hold: number; sell: number; brokers: number; medianTarget?: number; upsidePct?: number }

/** Latest call per broker, then counts and the median target. */
export function consensus(calls: AnalystCall[], price?: number, now = Date.now() / 1000, maxAgeDays = 120): { latest: AnalystCall[]; summary: Consensus } {
  const byBroker = new Map<string, AnalystCall>();
  for (const c of [...calls].sort((a, b) => b.time - a.time)) {
    if (now - c.time > maxAgeDays * 86400) continue;
    if (!byBroker.has(c.broker)) byBroker.set(c.broker, c);
  }
  const latest = [...byBroker.values()];
  const targets = latest.flatMap((c) => (c.target ? [c.target] : [])).sort((a, b) => a - b);
  const medianTarget = targets.length ? (targets.length % 2 ? targets[(targets.length - 1) / 2] : (targets[targets.length / 2 - 1] + targets[targets.length / 2]) / 2) : undefined;
  return {
    latest,
    summary: {
      buy: latest.filter((c) => c.rating === "buy").length, hold: latest.filter((c) => c.rating === "hold").length, sell: latest.filter((c) => c.rating === "sell").length,
      brokers: latest.length, medianTarget, upsidePct: medianTarget && price ? ((medianTarget - price) / price) * 100 : undefined,
    },
  };
}

const FEED = "https://news.google.com/rss/search";
async function feed(q: string, fetchImpl: typeof fetch): Promise<NewsItem[]> {
  const res = await fetchImpl(`${FEED}?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`news feed returned HTTP ${res.status}`);
  return parseFeed(await res.text());
}

const names = ["Jefferies", '"ICICI Securities"', '"HDFC Securities"', '"Motilal Oswal"', "Kotak", "Nomura", "CLSA", '"Goldman Sachs"', '"Morgan Stanley"', "Macquarie", "Emkay", "Nuvama"];

export async function fetchCompanyNews(company: string, fetchImpl: typeof fetch = fetch): Promise<{ news: NewsItem[]; calls: AnalystCall[] }> {
  const q = company.replace(/["]/g, "").trim();
  const [news, callFeed] = await Promise.all([
    feed(`"${q}" when:14d`, fetchImpl),
    feed(`"${q}" (target OR rating OR buy OR sell) (${names.join(" OR ")}) when:120d`, fetchImpl).catch(() => [] as NewsItem[]),
  ]);
  const calls = callFeed.flatMap((i) => { const c = parseCall(i); return c && i.title.toLowerCase().includes(q.split(/\s+/)[0].toLowerCase()) ? [c] : []; });
  return { news: news.slice(0, 25), calls };
}
