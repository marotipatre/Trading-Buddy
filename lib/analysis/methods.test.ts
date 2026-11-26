import { describe, it, expect } from "vitest";
import { assessMethod, METHODS } from "./methods";
import type { Candle } from "@/lib/data/types";

const mk = (f: (i: number) => number, n = 600): Candle[] => Array.from({ length: n }, (_, i) => { const c = f(i); return { time: 1_600_000_000 + i * 86400, open: c, high: c * 1.01, low: c * 0.99, close: c, volume: 1e5 }; });
const strong = mk((i) => 100 * Math.pow(1.0018, i) + Math.sin(i / 7) * 2);
const weak = mk((i) => 300 * Math.pow(0.9985, i) + Math.sin(i / 7) * 2);

describe("methods", () => {
  it("lists four methods with sources", () => {
    expect(METHODS.map((m) => m.id)).toEqual(["trend", "minervini", "momentum", "pullback"]);
    expect(METHODS.every((m) => m.source && m.blurb)).toBe(true);
  });
  it("Minervini passes a steady leader and fails a decliner, with eight checks listed", () => {
    const a = assessMethod("S", strong, "minervini")!, b = assessMethod("W", weak, "minervini")!;
    expect(a.reasons).toHaveLength(9);
    expect(a.score).toBeGreaterThan(b.score);
    expect(b.verdict).toBe("avoid");
    expect(a.score).toBeGreaterThanOrEqual(80);
  });
  it("momentum ranks a rising stock above a falling one and states its inputs", () => {
    const a = assessMethod("S", strong, "momentum")!, b = assessMethod("W", weak, "momentum")!;
    expect(a.score).toBeGreaterThan(b.score);
    expect(a.reasons[0].text).toContain("12-month");
  });
  it("pullback scores a dip in an uptrend above a straight-line riser", () => {
    const dip = mk((i) => 100 * Math.pow(1.0015, i) * (i > 590 ? 1 - (i - 590) * 0.004 : 1) + Math.sin(i / 7));
    expect(assessMethod("D", dip, "pullback")!.score).toBeGreaterThan(assessMethod("S", strong, "pullback")!.score);
  });
  it("returns null without a year of history", () => {
    expect(assessMethod("X", mk((i) => 100 + i, 220), "minervini")).toBeNull();
  });
});
