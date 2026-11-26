import { describe, it, expect } from "vitest";
import { parseCandlesCsv, parseDate } from "./csv";

describe("parseDate", () => {
  const ymd = (s: string) => new Date(parseDate(s)! * 1000).toISOString().slice(0, 10);
  it("parses ISO, day-first and NSE month-name formats", () => {
    expect(ymd("2024-03-15")).toBe("2024-03-15");
    expect(ymd("15-03-2024")).toBe("2024-03-15");
    expect(ymd("15/03/2024")).toBe("2024-03-15");
    expect(ymd("15-Mar-2024")).toBe("2024-03-15");
    expect(ymd('"05 Jan 2023"')).toBe("2023-01-05");
  });
  it("treats slashes as day-first (India), so 03/04/2024 is 3 April", () => {
    expect(ymd("03/04/2024")).toBe("2024-04-03");
  });
  it("rejects impossible or unknown dates", () => {
    expect(parseDate("2024-02-31")).toBeNull();
    expect(parseDate("hello")).toBeNull();
    expect(parseDate("15-Foo-2024")).toBeNull();
  });
  it("stamps bars at the 09:15 IST open", () => {
    expect(new Date(parseDate("2024-03-15")! * 1000).toISOString()).toBe("2024-03-15T03:45:00.000Z");
  });
});

describe("parseCandlesCsv", () => {
  const csv = `Date,Open,High,Low,Close,Volume
2024-01-03,102,106,101,105,1000
2024-01-02,100,103,99,102,"1,500"
`;
  it("parses, sorts ascending and handles quoted thousands", () => {
    const r = parseCandlesCsv(csv);
    expect(r.candles.map((c) => c.close)).toEqual([102, 105]);
    expect(r.candles[0].volume).toBe(1500);
    expect(r.skipped).toBe(0);
  });
  it("accepts NSE-style headers, semicolons and extra columns", () => {
    const r = parseCandlesCsv("Date;Open Price;High Price;Low Price;Close Price;Adj Close;Volume\n02-Jan-2024;100;103;99;102;101;50");
    expect(r.candles).toHaveLength(1);
    expect(r.candles[0].close).toBe(102);
  });
  it("skips corrupt rows but keeps good ones and reports them", () => {
    const r = parseCandlesCsv(`${csv}2024-01-04,abc,1,1,1,1\n2024-01-05,100,90,95,98,1\nnot-a-date,1,2,1,2,3\n`);
    expect(r.candles).toHaveLength(2);
    expect(r.skipped).toBe(3);
    expect(r.warnings[0]).toMatch(/3 row/);
  });
  it("merges duplicate dates, last wins", () => {
    const r = parseCandlesCsv(`${csv}2024-01-02,100,115,99,111,5\n`);
    expect(r.candles).toHaveLength(2);
    expect(r.candles[0].close).toBe(111);
  });
  it("explains missing columns and empty files", () => {
    expect(parseCandlesCsv("Date,Open,Close\n2024-01-02,1,2").warnings[0]).toMatch(/Missing required column.*high.*low/);
    expect(parseCandlesCsv("Date,Open,High,Low,Close").candles).toEqual([]);
  });
  it("handles BOM and CRLF line endings", () => {
    const r = parseCandlesCsv("﻿Date,Open,High,Low,Close\r\n2024-01-02,100,103,99,102\r\n");
    expect(r.candles).toHaveLength(1);
  });
});
