import { describe, it, expect } from "vitest";
import { tradesToCsv } from "./export-csv";
import type { ClosedTrade } from "@/lib/paper/types";

const t = (o: Partial<ClosedTrade> = {}): ClosedTrade => ({ id: 1, symbol: "RELIANCE.NS", direction: "long", product: "delivery", qty: 10, entryPrice: 100, exitPrice: 110, entryTime: 1_700_000_000, exitTime: 1_700_086_400, grossPnl: 100, charges: 5.5, netPnl: 94.5, returnPct: 9.45, reason: "target", ...o });
describe("tradesToCsv", () => {
  it("writes a header and one row per trade", () => {
    const lines = tradesToCsv([t(), t({ symbol: "TCS.NS" })]).split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0].startsWith("symbol,direction")).toBe(true);
    expect(lines[1]).toContain("RELIANCE.NS,long,delivery,10");
    expect(lines[1]).toContain("94.50");
  });
  it("quotes commas and quotes, and defuses spreadsheet formulas", () => {
    const line = tradesToCsv([t({ note: 'said "wait", then bought', tags: ["a", "b"] })]).split("\n")[1];
    expect(line).toContain('"said ""wait"", then bought"');
    expect(line).toContain("a|b");
    expect(tradesToCsv([t({ note: "=HYPERLINK(\"x\")" })])).toContain("'=HYPERLINK");
  });
  it("keeps negative numbers as numbers", () => {
    expect(tradesToCsv([t({ netPnl: -50, grossPnl: -45 })])).toContain("-50.00");
  });
});
