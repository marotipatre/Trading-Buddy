import { describe, it, expect } from "vitest";
import { companyName, displaySymbol, exchangeOf, rememberName, tidyName, toProviderSymbol } from "./symbols";
import { POPULAR_STOCKS, INDICES } from "./universe";

describe("displaySymbol / exchangeOf", () => {
  it("shows broker-style labels", () => {
    expect(displaySymbol("RELIANCE.NS")).toBe("RELIANCE");
    expect(displaySymbol("500325.BO")).toBe("500325");
    expect(displaySymbol("^NSEI")).toBe("NIFTY 50");
    expect(displaySymbol("^NSEBANK")).toBe("BANK NIFTY");
    expect(displaySymbol("M&M.NS")).toBe("M&M");
    expect(displaySymbol("^NIFTY_REALTY")).toBe("NIFTY REALTY");
  });
  it("identifies the exchange", () => {
    expect(exchangeOf("TCS.NS")).toBe("NSE");
    expect(exchangeOf("TCS.BO")).toBe("BSE");
    expect(exchangeOf("^NSEI")).toBe("INDEX");
  });
});

describe("toProviderSymbol", () => {
  it("accepts what a person types", () => {
    expect(toProviderSymbol("reliance")).toBe("RELIANCE.NS");
    expect(toProviderSymbol(" tcs ", "BSE")).toBe("TCS.BO");
    expect(toProviderSymbol("RELIANCE.NS")).toBe("RELIANCE.NS");
    expect(toProviderSymbol("nifty 50")).toBe("^NSEI");
    expect(toProviderSymbol("^NSEBANK")).toBe("^NSEBANK");
  });
  it("round-trips with displaySymbol for equities", () => {
    for (const i of POPULAR_STOCKS) expect(toProviderSymbol(displaySymbol(i.symbol))).toBe(i.symbol);
  });
});

describe("company names", () => {
  it("knows popular stocks and indices out of the box", () => {
    expect(companyName("RELIANCE.NS")).toBe("Reliance Industries");
    expect(companyName("^NSEI")).toBe("NIFTY 50");
    expect(companyName("UNKNOWN.NS")).toBeUndefined();
  });
  it("learns names from search results and ignores echoes of the ticker", () => {
    rememberName("ZYDUSLIFE.NS", "Zydus Lifesciences Ltd");
    expect(companyName("ZYDUSLIFE.NS")).toBe("Zydus Lifesciences Ltd");
    rememberName("FOO.NS", "FOO");
    expect(companyName("FOO.NS")).toBeUndefined();
  });
  it("tidies capitals-only names", () => {
    expect(tidyName("RELIANCE INDUSTRIES LTD")).toBe("Reliance Industries Ltd");
    expect(tidyName("Tata Motors")).toBe("Tata Motors");
  });
});

describe("universe", () => {
  it("has unique, well-formed symbols", () => {
    const all = [...INDICES, ...POPULAR_STOCKS];
    expect(new Set(all.map((i) => i.symbol)).size).toBe(all.length);
    for (const i of POPULAR_STOCKS) expect(i.symbol).toMatch(/^[A-Z0-9&_-]+\.NS$/);
  });
});
