import { describe, it, expect, vi } from "vitest";
import { buildUniverse, filterUniverse, getUniverse, normalizeSector, parseConstituents, sectorsOf } from "./universe-data";

const csv = (rows: string[]) => ["Company Name,Industry,Symbol,Series,ISIN Code", ...rows].join("\r\n");
const large = parseConstituents(csv([
  "Reliance Industries Ltd.,Oil Gas & Consumable Fuels,RELIANCE,EQ,INE002A01018",
  "HDFC Bank Ltd.,Financial Services,HDFCBANK,EQ,INE040A01034",
  '"Mahindra & Mahindra Ltd.",Automobile and Auto Components,M&M,EQ,INE101A01026',
]));
const mid = parseConstituents(csv([
  "ABB India Ltd.,Capital Goods,ABB,EQ,INE117A01022",
  "HDFC Bank Ltd.,Financial Services,HDFCBANK,EQ,INE040A01034", // duplicate of a large cap
]));
const small = parseConstituents(csv([
  "Tiny Co Limited,Textiles,TINY,EQ,INE000000001",
  "Weird Co,Some New Industry,WEIRD,EQ,INE000000002",
]));

describe("parseConstituents", () => {
  it("reads rows, quoted names and ISINs", () => {
    expect(large).toHaveLength(3);
    expect(large[2]).toMatchObject({ name: "Mahindra & Mahindra Ltd.", ticker: "M&M", industry: "Automobile and Auto Components", isin: "INE101A01026" });
  });
  it("handles BOM and ignores blank or junk symbol rows", () => {
    const rows = parseConstituents("﻿Company Name,Industry,Symbol,Series,ISIN Code\r\nA Ltd,Power,AAA,EQ,X\r\n,,,,\r\nDummy,Power,DUMMY ONE,EQ,Y\r\n");
    expect(rows.map((r) => r.ticker)).toEqual(["AAA"]);
  });
  it("returns [] for empty or headerless input", () => {
    expect(parseConstituents("")).toEqual([]);
    expect(parseConstituents("nothing useful\nhere")).toEqual([]);
  });
});

describe("buildUniverse", () => {
  const u = buildUniverse(large, mid, small);
  it("maps symbols to the data-provider form and keeps the largest class on duplicates", () => {
    expect(u.find((s) => s.symbol === "HDFCBANK.NS")?.cap).toBe("large");
    expect(u.filter((s) => s.symbol === "HDFCBANK.NS")).toHaveLength(1);
    expect(u.find((s) => s.symbol === "ABB.NS")?.cap).toBe("mid");
    expect(u.find((s) => s.symbol === "TINY.NS")?.cap).toBe("small");
    expect(u).toHaveLength(6);
  });
  it("shortens company names and sector labels", () => {
    expect(u.find((s) => s.symbol === "RELIANCE.NS")).toMatchObject({ name: "Reliance Industries", sector: "Oil & Gas" });
    expect(u.find((s) => s.symbol === "M&M.NS")?.sector).toBe("Auto");
    expect(u.find((s) => s.symbol === "TINY.NS")?.name).toBe("Tiny Co");
  });
  it("keeps unknown industries as they are", () => {
    expect(normalizeSector("Some New Industry")).toBe("Some New Industry");
    expect(normalizeSector("")).toBe("Other");
    expect(normalizeSector("Information Technology")).toBe("IT");
  });
});

describe("sectorsOf and filterUniverse", () => {
  const u = buildUniverse(large, mid, small);
  it("counts sectors, biggest first", () => {
    const s = sectorsOf(u);
    expect(s.reduce((a, x) => a + x.count, 0)).toBe(u.length);
    expect(new Set(s.map((x) => x.name)).size).toBe(s.length);
  });
  it("filters by class, sector and text", () => {
    expect(filterUniverse(u, { cap: "large" })).toHaveLength(3);
    expect(filterUniverse(u, { cap: "all", sector: "Financials" }).map((s) => s.symbol)).toEqual(["HDFCBANK.NS"]);
    expect(filterUniverse(u, { q: "reli" }).map((s) => s.symbol)).toEqual(["RELIANCE.NS"]);
    expect(filterUniverse(u, { q: "abb", cap: "large" })).toEqual([]);
    expect(filterUniverse(u, {})).toHaveLength(u.length);
  });
});

describe("getUniverse", () => {
  it("fails clearly when the lists cannot be downloaded and there is no cache to fall back on", async () => {
    const f = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    await expect(getUniverse(f, { cacheFile: null })).rejects.toThrow(/NSE Indices HTTP 503/);
  });
  it("downloads, builds and returns the three lists when the network works", async () => {
    const mk = (n: number, ind: string) => csv(Array.from({ length: n }, (_, i) => `Co ${ind}${i} Ltd,${ind},${ind.slice(0, 2).toUpperCase()}${i}X,EQ,INE${i}`));
    const f = vi.fn().mockImplementation(async (url: string) =>
      new Response(url.includes("nifty100") ? mk(100, "Power") : url.includes("midcap150") ? mk(150, "Healthcare") : url.includes("microcap") ? mk(250, "Realty") : mk(251, "Textiles"), { status: 200 }));
    const u = await getUniverse(f, { cacheFile: null });
    expect(u.stocks).toHaveLength(751);
    expect(u.stocks.filter((s) => s.cap === "micro")).toHaveLength(250);
    expect(u.stocks.filter((s) => s.cap === "large")).toHaveLength(100);
    expect(f).toHaveBeenCalledTimes(8);
  });
  it("still works when the microcap list cannot be fetched", async () => {
    const mk = (n: number, ind: string) => csv(Array.from({ length: n }, (_, i) => `Co ${ind}${i} Ltd,${ind},${ind.slice(0, 2).toUpperCase()}${i}X,EQ,INE${i}`));
    const f = vi.fn().mockImplementation(async (url: string) => url.includes("microcap") ? new Response("", { status: 404 }) : new Response(url.includes("nifty100") ? mk(100, "Power") : url.includes("midcap150") ? mk(150, "Healthcare") : mk(251, "Textiles"), { status: 200 }));
    const u = await getUniverse(f, { cacheFile: null });
    expect(u.stocks).toHaveLength(501);
  });
});

describe("whole listed market", () => {
  it("adds every other NSE stock, SME as its own class, and leaves out ETFs", async () => {
    const { mergeListed } = await import("./universe-lists");
    const base = [{ symbol: "AAA.NS", name: "Aaa", sector: "IT", cap: "large" as const, isin: "" }];
    const out = mergeListed(base, [
      { symbol: "AAA.NS", name: "Aaa Ltd", series: "EQ" }, { symbol: "BBB.NS", name: "Bbb Ltd", series: "EQ" },
      { symbol: "CCC.NS", name: "Ccc Ltd", series: "SM" }, { symbol: "NV20BEES.NS", name: "Nippon ETF", series: "EQ" }, { symbol: "GOLD360.NS", name: "360oneamc - Gold360", series: "EQ" },
    ]);
    expect(out.map((s) => [s.symbol, s.cap, s.sector])).toEqual([["AAA.NS", "large", "IT"], ["BBB.NS", "other", "Unclassified"], ["CCC.NS", "sme", "Unclassified"]]);
  });
});

describe("scan scopes", () => {
  it("tags stocks with their index lists and knows which scans cover which", async () => {
    const { applyLists, inScope, scopeCovers } = await import("./universe-lists");
    const stocks = [{ symbol: "A.NS", name: "A", sector: "IT", cap: "large" as const, isin: "" }, { symbol: "B.NS", name: "B", sector: "IT", cap: "mid" as const, isin: "" }];
    const c = (t: string) => ({ name: t, industry: "", ticker: t, series: "EQ", isin: "" });
    const out = applyLists(stocks, { n50: [c("A")], n500: [c("A"), c("B")], m30: [c("B")] });
    expect(inScope(out[1], "mid")).toBe(true); expect(inScope(out[1], "small")).toBe(false); expect(inScope(out[0], "mid")).toBe(false);
    expect(scopeCovers("n500", "mid")).toBe(true); expect(scopeCovers("n200", "n50")).toBe(true); expect(scopeCovers("n200", "mid")).toBe(false);
    expect(out[0].lists).toEqual(["n50", "n500"]); expect(out[1].lists).toEqual(["n500", "m30"]);
    expect(inScope(out[0], "n50")).toBe(true); expect(inScope(out[1], "n50")).toBe(false); expect(inScope(out[1], "all")).toBe(true);
    expect(scopeCovers("n500", "n50")).toBe(true); expect(scopeCovers("n50", "n500")).toBe(false); expect(scopeCovers("all", "m30")).toBe(true);
  });
});
