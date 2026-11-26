import { describe, it, expect } from "vitest";
import { cleanShare, mistakeCounts, pickDateOf, userNote, withUserNote } from "./journal";
import type { ClosedTrade } from "@/lib/paper/types";

const t = (o: Partial<ClosedTrade>) => ({ id: 1, exitTime: 100, ...o }) as ClosedTrade;
describe("intraday journal helpers", () => {
  it("reads the pick marker and keeps it when the note is edited", () => {
    const a = t({ note: "pick:2026-11-27 | entered late" });
    expect(pickDateOf(a)).toBe("2026-11-27");
    expect(userNote(a)).toBe("entered late");
    expect(withUserNote(a, "new text")).toBe("pick:2026-11-27 | new text");
    expect(withUserNote(a, "")).toBe("pick:2026-11-27");
    expect(pickDateOf(t({ note: "hello" }))).toBeNull();
    expect(withUserNote(t({}), " hi ")).toBe("hi");
  });
  it("counts mistake tags since a date, ignoring other tags", () => {
    const trades = [t({ tags: ["revenge trade", "x"], exitTime: 200 }), t({ tags: ["revenge trade", "moved stop"], exitTime: 300 }), t({ tags: ["chased entry"], exitTime: 50 })];
    expect(mistakeCounts(trades, 100)).toEqual([{ tag: "revenge trade", count: 2 }, { tag: "moved stop", count: 1 }]);
  });
  it("measures the share of clean trades", () => {
    expect(cleanShare([t({}), t({ tags: ["no plan"] }), t({ tags: ["custom"] }), t({})])).toBe(0.75);
    expect(cleanShare([])).toBe(1);
  });
});
