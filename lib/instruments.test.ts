import { describe, it, expect } from "vitest";
import { buildInstruments, scoreInstrument, searchInstruments, type Instrument, type Row } from "./instruments";

const nse: Row[] = [
  { segment: "NSE_EQ", instrument_type: "EQ", trading_symbol: "RELIANCE", instrument_key: "NSE_EQ|INE002A01018", name: "RELIANCE INDUSTRIES LTD", isin: "INE002A01018" },
  { segment: "NSE_EQ", instrument_type: "EQ", trading_symbol: "RELINFRA", instrument_key: "NSE_EQ|INE036A01016", name: "RELIANCE INFRASTRUCTURE LTD" },
  { segment: "NSE_EQ", instrument_type: "EQ", trading_symbol: "TCS", instrument_key: "NSE_EQ|INE467B01029", name: "TATA CONSULTANCY SERV LT" },
  { segment: "NSE_EQ", instrument_type: "EQ", trading_symbol: "TATAMOTORS", instrument_key: "NSE_EQ|INE155A01022", name: "TATA MOTORS LIMITED" },
  { segment: "NSE_EQ", instrument_type: "EQ", trading_symbol: "M&M", instrument_key: "NSE_EQ|INE101A01026", name: "MAHINDRA & MAHINDRA LTD" },
  { segment: "NSE_EQ", instrument_type: "SM", trading_symbol: "KCK", instrument_key: "NSE_EQ|INE0KCK01011", name: "KCK INDUSTRIES LTD" },
  { segment: "NSE_EQ", instrument_type: "SG", trading_symbol: "749RJ35", instrument_key: "NSE_EQ|IN2920250010", name: "SDL RJ 7.49% 2035" },
  { segment: "NSE_EQ", instrument_type: "N0", trading_symbol: "NCDX", instrument_key: "NSE_EQ|INE000000X", name: "SOME NCD" },
  { segment: "NSE_FO", instrument_type: "FUT", trading_symbol: "RELIANCE", instrument_key: "NSE_FO|1", name: "RELIANCE FUT" },
  { segment: "NSE_INDEX", instrument_type: "INDEX", trading_symbol: "Nifty 50", instrument_key: "NSE_INDEX|Nifty 50", name: "Nifty 50" },
  { segment: "NSE_INDEX", instrument_type: "INDEX", trading_symbol: "Nifty Realty", instrument_key: "NSE_INDEX|Nifty Realty", name: "Nifty Realty" },
];
const bse: Row[] = [
  { segment: "BSE_EQ", instrument_type: "A", trading_symbol: "RELIANCE", instrument_key: "BSE_EQ|INE002A01018", name: "RELIANCE INDUSTRIES LTD." },
  { segment: "BSE_EQ", instrument_type: "F", trading_symbol: "775IRFC33", instrument_key: "BSE_EQ|IN1", name: "IRFC-7.75%-15-4-33-PVT" },
  { segment: "BSE_EQ", instrument_type: "X", trading_symbol: "COSMOFE", instrument_key: "BSE_EQ|INE2", name: "COSMO FERRITES LTD." },
  { segment: "BSE_INDEX", instrument_type: "INDEX", trading_symbol: "SENSEX", instrument_key: "BSE_INDEX|SENSEX", name: "SENSEX" },
];
const list = buildInstruments(nse, bse);
const find = (symbol: string) => list.find((i) => i.symbol === symbol);

describe("buildInstruments", () => {
  it("keeps real equities (including SME) and drops bonds, government securities and derivatives", () => {
    const syms = list.map((i) => i.symbol);
    expect(syms).toContain("KCK.NS");
    expect(syms).toContain("COSMOFE.BO");
    expect(syms).not.toContain("749RJ35.NS");
    expect(syms).not.toContain("NCDX.NS");
    expect(syms).not.toContain("775IRFC33.BO");
    expect(list.filter((i) => i.symbol === "RELIANCE.NS")).toHaveLength(1);
  });
  it("uses .NS and .BO suffixes so one company can be traded on either exchange", () => {
    expect(find("RELIANCE.NS")).toMatchObject({ exchange: "NSE", kind: "stock", key: "NSE_EQ|INE002A01018", name: "Reliance Industries Ltd" });
    expect(find("RELIANCE.BO")).toMatchObject({ exchange: "BSE", key: "BSE_EQ|INE002A01018" });
  });
  it("gives the main indices their familiar symbols and other indices a readable one", () => {
    expect(find("^NSEI")).toMatchObject({ kind: "index", name: "Nifty 50" });
    expect(find("^BSESN")).toMatchObject({ kind: "index", exchange: "BSE" });
    expect(find("^NIFTY_REALTY")).toMatchObject({ kind: "index", key: "NSE_INDEX|Nifty Realty" });
  });
  it("has unique symbols", () => {
    expect(new Set(list.map((i) => i.symbol)).size).toBe(list.length);
  });
});

describe("searchInstruments", () => {
  const top = (q: string, n = 5) => searchInstruments(list, q, n).map((i) => i.symbol);

  it("finds an exact ticker first, and offers both exchanges, NSE first", () => {
    expect(top("reliance")[0]).toBe("RELIANCE.NS");
    expect(top("reliance")).toContain("RELIANCE.BO");
    expect(top("tcs")[0]).toBe("TCS.NS");
  });
  it("matches ticker prefixes and name prefixes", () => {
    expect(top("relin")).toEqual(["RELINFRA.NS"]);
    expect(top("tata")).toEqual(expect.arrayContaining(["TATAMOTORS.NS", "TCS.NS"]));
    expect(top("mahindra")[0]).toBe("M&M.NS");
  });
  it("matches multi-word queries against name words", () => {
    expect(top("tata mot")[0]).toBe("TATAMOTORS.NS");
    expect(top("tata cons")[0]).toBe("TCS.NS");
    expect(top("reliance ind")[0]).toBe("RELIANCE.NS");
  });
  it("handles special characters, case and whitespace", () => {
    expect(top("m&m")[0]).toBe("M&M.NS");
    expect(top("  NIFTY  ")).toEqual(expect.arrayContaining(["^NSEI", "^NIFTY_REALTY"]));
    expect(top("RELIANCE")).toEqual(top("reliance"));
  });
  it("finds indices and SME stocks", () => {
    expect(top("sensex")[0]).toBe("^BSESN");
    expect(top("realty")[0]).toBe("^NIFTY_REALTY");
    expect(top("kck")[0]).toBe("KCK.NS");
  });
  it("returns nothing for empty or unmatched queries and respects the limit", () => {
    expect(top("")).toEqual([]);
    expect(top("zzzzqqq")).toEqual([]);
    expect(top("e", 2)).toHaveLength(2);
  });
  it("ranks exact over prefix over substring", () => {
    const mk = (symbol: string, name: string): Instrument => ({ symbol, name, exchange: "NSE", kind: "stock", series: "EQ", key: "k" });
    const a = scoreInstrument(mk("ABC.NS", "Zed"), "abc");
    const b = scoreInstrument(mk("ABCD.NS", "Zed"), "abc");
    const c = scoreInstrument(mk("XABC.NS", "Zed"), "abc");
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
    expect(c).toBeGreaterThan(0);
  });
});

describe("search ranking refinements", () => {
  const mk = (symbol: string, name: string, kind: Instrument["kind"] = "stock", series = "EQ"): Instrument => ({ symbol, name, exchange: "NSE", kind, series, key: "k" });
  const sensexList = [mk("SENSEXETF.NS", "Some Sensex ETF"), mk("SENSEXADD.NS", "Sensex Additional ETF"), mk("^BSESN", "SENSEX", "index", "INDEX")];

  it("an index typed in full beats ETFs whose ticker merely starts with it", () => {
    expect(searchInstruments(sensexList, "sensex")[0].symbol).toBe("^BSESN");
  });
  it("boosted (well-known) symbols win ties against obscure look-alikes", () => {
    const l = [mk("BAJAJST.NS", "Bajaj Steel Industries"), mk("BAJFINANCE.NS", "Bajaj Finance"), mk("BAJAJ-AUTO.NS", "Bajaj Auto")];
    const boost = new Set(["BAJFINANCE.NS", "BAJAJ-AUTO.NS"]);
    const top = searchInstruments(l, "bajaj", 3, boost).map((i) => i.symbol);
    expect(top.slice(0, 2).sort()).toEqual(["BAJAJ-AUTO.NS", "BAJFINANCE.NS"]);
    expect(top[2]).toBe("BAJAJST.NS");
  });
  it("without a boost list, behaviour is unchanged", () => {
    expect(searchInstruments(sensexList, "sensex", 3)).toHaveLength(3);
  });
});
