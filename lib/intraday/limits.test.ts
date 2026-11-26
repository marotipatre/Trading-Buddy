import { describe, it, expect } from "vitest";
import { dayStatus } from "./limits";
import { newAccount } from "@/lib/paper/broker";
import type { ClosedTrade, PaperPosition } from "@/lib/paper/types";

const NOW = Date.parse("2026-11-27T06:00:00Z") / 1000; // 11:30 IST
const trade = (id: number, minutesAgo: number, netPnl: number): ClosedTrade => ({ id, symbol: "X.NS", direction: "long", product: "intraday", qty: 1, entryPrice: 1, exitPrice: 1, entryTime: NOW - 3600, exitTime: NOW - minutesAgo * 60, grossPnl: netPnl, charges: 0, netPnl, returnPct: 0, reason: "manual" });
const state = (trades: ClosedTrade[], positions: PaperPosition[] = []) => ({ ...newAccount(500000), trades, positions });

describe("dayStatus", () => {
  it("is open with no trades", () => { expect(dayStatus(state([]), 100000, NOW).locked).toBe(false); });
  it("locks at the daily loss limit", () => {
    const s = dayStatus(state([trade(1, 60, -1200), trade(2, 30, -900)]), 100000, NOW);
    expect(s.pnlToday).toBe(-2100);
    expect(s.locked).toBe(true);
    expect(s.reason).toContain("loss limit");
  });
  it("locks after three losses in a row but not if a win broke the streak", () => {
    expect(dayStatus(state([trade(1, 90, -100), trade(2, 60, -100), trade(3, 30, -100)]), 100000, NOW).reason).toContain("in a row");
    expect(dayStatus(state([trade(1, 90, -100), trade(2, 60, 500), trade(3, 30, -100), trade(4, 20, -100)]), 100000, NOW).lossStreak).toBe(2);
  });
  it("locks at the trade cap, counting open positions", () => {
    const open = { id: 9, symbol: "Y.NS", entryTime: NOW - 600 } as PaperPosition;
    const s = dayStatus(state([trade(1, 90, 100), trade(2, 60, 100), trade(3, 30, 100)], [open]), 100000, NOW);
    expect(s.tradesToday).toBe(4);
    expect(s.reason).toContain("limit 4");
  });
  it("ignores yesterday", () => {
    const old = { ...trade(1, 60, -5000), exitTime: NOW - 86400 };
    expect(dayStatus(state([old]), 100000, NOW).locked).toBe(false);
  });
});
