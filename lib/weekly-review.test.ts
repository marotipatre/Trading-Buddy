import { describe, it, expect } from "vitest";
import { weekStartOf, weeklyReview } from "./weekly-review";
import type { ClosedTrade } from "@/lib/paper/types";

const NOW = Date.parse("2026-11-27T06:00:00Z") / 1000; // Friday
const t = (id: number, daysAgo: number, netPnl: number, tags: string[] = [], rMultiple?: number): ClosedTrade => ({ id, symbol: "X.NS", direction: "long", product: "delivery", qty: 1, entryPrice: 1, exitPrice: 1, entryTime: NOW - daysAgo * 86400 - 3600, exitTime: NOW - daysAgo * 86400, grossPnl: netPnl, charges: 0, netPnl, returnPct: 0, reason: "manual", tags, rMultiple });

describe("weekly review", () => {
  it("starts the week on Monday in IST", () => {
    expect(new Date((weekStartOf(NOW) + 19800) * 1000).getUTCDay()).toBe(1);
    expect(weekStartOf(NOW)).toBeLessThanOrEqual(NOW);
    expect(NOW - weekStartOf(NOW)).toBeLessThan(7 * 86400);
  });
  it("counts only this week's trades and totals them", () => {
    const r = weeklyReview([t(1, 0, 500, [], 1.5), t(2, 1, -200, [], -1), t(3, 20, 9999)], NOW);
    expect(r.trades).toBe(2);
    expect(r.wins).toBe(1);
    expect(r.netPnl).toBe(300);
    expect(r.avgR).toBeCloseTo(0.25);
    expect(r.best?.id).toBe(1);
    expect(r.worst?.id).toBe(2);
  });
  it("finds the most common mistake and links its rule", () => {
    const r = weeklyReview([t(1, 0, -100, ["Revenge trade"]), t(2, 0, -50, ["revenge trade", "No stop"]), t(3, 1, 80, ["Followed plan"])], NOW);
    expect(r.mistakes[0]).toEqual({ tag: "Revenge trade", count: 2 });
    expect(r.mistakes.length).toBe(2);
    expect(r.focus?.advice.length).toBeGreaterThan(20);
    expect(r.clean).toBeCloseTo(1 / 3);
  });
  it("copes with an empty week", () => {
    const r = weeklyReview([], NOW);
    expect(r.trades).toBe(0);
    expect(r.focus).toBeUndefined();
    expect(r.clean).toBe(1);
  });
});

import { TAG_ADVICE } from "./weekly-review";
import { BOOKS } from "./playbook/content";
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
describe("advice links", () => {
  it("every advice anchor points at a real section of its rule book", () => {
    for (const a of TAG_ADVICE) {
      const book = BOOKS.find((b) => b.id === a.book)!;
      const ids = new Set([...book.sections.map((s) => slug(s.title)), "checklist", "constitution", "path"]);
      expect(ids.has(a.anchor), `${a.book}#${a.anchor}`).toBe(true);
    }
  });
});
