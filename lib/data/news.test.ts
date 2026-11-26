import { describe, it, expect } from "vitest";
import { consensus, parseCall, parseFeed, type AnalystCall, type NewsItem } from "./news";

const item = (title: string, time = 1_700_000_000): NewsItem => ({ title, source: "X", link: "https://e.com/" + title.length, time });

describe("parseFeed", () => {
  it("reads titles, sources and dates and strips the source suffix", () => {
    const xml = `<rss><channel><item><title>RIL: Jefferies sees growth - Business Standard</title><link>https://n/1</link><pubDate>Thu, 26 Nov 2026 18:09:00 GMT</pubDate><source url="x">Business Standard</source></item><item><title>No date</title><link>https://n/2</link></item></channel></rss>`;
    const r = parseFeed(xml);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ title: "RIL: Jefferies sees growth", source: "Business Standard", link: "https://n/1" });
  });
});

describe("parseCall", () => {
  it("finds broker, rating and target in a headline", () => {
    expect(parseCall(item("Jefferies maintains Buy on Reliance, target price Rs 1,700"))).toMatchObject({ broker: "Jefferies", rating: "buy", target: 1700 });
    expect(parseCall(item("ICICI Securities initiates Add on Tata Motors with TP of ₹ 950.5"))).toMatchObject({ broker: "ICICI Securities", rating: "buy", target: 950.5 });
    expect(parseCall(item("HDFC Securities downgrades Infosys to Sell; target at Rs 1400"))).toMatchObject({ broker: "HDFC Securities", rating: "sell", target: 1400 });
    expect(parseCall(item("Motilal Oswal stays neutral on HUL"))).toMatchObject({ broker: "Motilal Oswal", rating: "hold" });
  });
  it("ignores headlines with no known broker, or a broker but no call", () => {
    expect(parseCall(item("Reliance stock jumps 3% on strong results"))).toBeNull();
    expect(parseCall(item("Jefferies India conference to be held in Mumbai"))).toBeNull();
  });
  it("keeps a target-only call as unrated rather than inventing a rating", () => {
    expect(parseCall(item("Nomura sets target price of Rs 2,000 for Titan"))).toMatchObject({ rating: "unrated", target: 2000 });
  });
});

describe("consensus", () => {
  const c = (broker: string, rating: AnalystCall["rating"], target: number, time: number): AnalystCall => ({ ...item(broker + target, time), broker, rating, target });
  const now = 1_700_000_000 + 10 * 86400;
  it("uses each broker's latest call, the median target, and upside", () => {
    const r = consensus([c("Jefferies", "hold", 1500, 1_700_000_000), c("Jefferies", "buy", 1700, 1_700_000_000 + 5 * 86400), c("CLSA", "buy", 1600, 1_700_000_000 + 6 * 86400), c("Nomura", "sell", 1200, 1_700_000_000 + 7 * 86400)], 1400, now);
    expect(r.summary).toMatchObject({ buy: 2, hold: 0, sell: 1, brokers: 3, medianTarget: 1600 });
    expect(r.summary.upsidePct).toBeCloseTo((200 / 1400) * 100);
  });
  it("drops stale calls", () => {
    expect(consensus([c("UBS", "buy", 1000, 1_000_000_000)], 900, now).summary.brokers).toBe(0);
  });
});
