import { describe, it, expect } from "vitest";
import { annotateTrade, normalizeTags, recordEquity } from "./journal";
import { newAccount } from "./broker";
import type { ClosedTrade } from "./types";

const trade = (id: number): ClosedTrade => ({
  id, symbol: "A", direction: "long", product: "delivery", qty: 1, entryPrice: 1, exitPrice: 1, entryTime: 0, exitTime: 1,
  grossPnl: 0, charges: 0, netPnl: 0, returnPct: 0, reason: "manual",
});

describe("normalizeTags", () => {
  it("trims, collapses spaces, dedupes case-insensitively and caps", () => {
    expect(normalizeTags(" FOMO ,fomo, Early   exit ,, ")).toEqual(["FOMO", "Early exit"]);
    expect(normalizeTags(Array.from({ length: 20 }, (_, i) => `t${i}`))).toHaveLength(8);
    expect(normalizeTags(["x".repeat(100)])[0]).toHaveLength(30);
  });
});

describe("annotateTrade", () => {
  it("updates only the targeted trade and only the given fields", () => {
    const s = { ...newAccount(1000), trades: [trade(1), trade(2)] };
    const a = annotateTrade(s, 2, { note: "Chased the open", tags: ["FOMO"] });
    expect(a.trades[0]).toEqual(trade(1));
    expect(a.trades[1]).toMatchObject({ note: "Chased the open", tags: ["FOMO"] });
    const b = annotateTrade(a, 2, { note: "Edited" });
    expect(b.trades[1]).toMatchObject({ note: "Edited", tags: ["FOMO"] });
  });
  it("is a no-op for an unknown id", () => {
    const s = { ...newAccount(1000), trades: [trade(1)] };
    expect(annotateTrade(s, 99, { note: "x" }).trades).toEqual(s.trades);
  });
});

describe("recordEquity", () => {
  it("starts a history and respects the minimum gap", () => {
    let s = newAccount(1000);
    s = recordEquity(s, 1000, 1000);
    s = recordEquity(s, 1010, 1100); // too soon
    expect(s.equityHistory).toHaveLength(1);
    s = recordEquity(s, 1010, 2000);
    expect(s.equityHistory).toHaveLength(2);
  });
  it("force bypasses the gap; non-finite values are ignored", () => {
    let s = recordEquity(newAccount(1000), 1000, 1000);
    s = recordEquity(s, 990, 1001, { force: true });
    expect(s.equityHistory).toHaveLength(2);
    expect(recordEquity(s, NaN, 5000)).toBe(s);
  });
  it("caps the history length", () => {
    let s = newAccount(1000);
    for (let i = 0; i < 3100; i++) s = recordEquity(s, 1000 + i, i * 1000);
    expect(s.equityHistory).toHaveLength(3000);
    expect(s.equityHistory!.at(-1)!.equity).toBe(1000 + 3099);
  });
});
