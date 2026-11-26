import { describe, it, expect } from "vitest";
import { barSeconds, DrawingSchema, drawingPriceAt, formatSpan, logicalToTime, measure, parseDrawings, pctFrom, timeToLogical, trendPriceAt, type Drawing } from "./drawings";

const DAY = 86400;
const times = [0, 1, 2, 3, 4].map((i) => 1_700_000_000 + i * DAY);

describe("time <-> bar position", () => {
  it("maps bar times to their index and interpolates between bars", () => {
    expect(timeToLogical(times, times[2])).toBe(2);
    expect(timeToLogical(times, times[2] + DAY / 2)).toBeCloseTo(2.5);
  });
  it("extrapolates before the first and after the last bar", () => {
    expect(timeToLogical(times, times[4] + 3 * DAY)).toBeCloseTo(7);
    expect(timeToLogical(times, times[0] - 2 * DAY)).toBeCloseTo(-2);
  });
  it("is the inverse of logicalToTime", () => {
    for (const idx of [-2, 0, 1.25, 3.5, 4, 6.75]) expect(timeToLogical(times, logicalToTime(times, idx))).toBeCloseTo(idx);
  });
  it("uses the median gap so weekends do not stretch the future", () => {
    const withWeekend = [0, 1, 2, 5, 6].map((i) => i * DAY);
    expect(barSeconds(withWeekend)).toBe(DAY);
  });
  it("copes with no or one bar", () => {
    expect(timeToLogical([], 5)).toBe(0);
    expect(barSeconds([1])).toBe(DAY);
    expect(timeToLogical([100], 100 + DAY)).toBeCloseTo(1);
  });
});

describe("measure", () => {
  it("reports change, percent, bars and span for an up move", () => {
    const m = measure({ time: times[0], price: 100 }, { time: times[3], price: 112 }, times);
    expect(m.dPrice).toBe(12);
    expect(m.dPct).toBeCloseTo(12);
    expect(m.bars).toBeCloseTo(3);
    expect(m.seconds).toBe(3 * DAY);
  });
  it("is negative for a down move and measures from the first point clicked, whichever side is earlier", () => {
    const m = measure({ time: times[3], price: 120 }, { time: times[0], price: 90 }, times);
    expect(m.dPct).toBeCloseTo(-25);
    expect(m.bars).toBeCloseTo(3);
    expect(m.seconds).toBe(3 * DAY);
  });
});

describe("trendlines", () => {
  const pts = [{ time: times[0], price: 100 }, { time: times[2], price: 110 }];
  it("extends the line past both points", () => {
    expect(trendPriceAt(pts, times, 0)).toBeCloseTo(100);
    expect(trendPriceAt(pts, times, 2)).toBeCloseTo(110);
    expect(trendPriceAt(pts, times, 4)).toBeCloseTo(120);
    expect(trendPriceAt(pts, times, -2)).toBeCloseTo(90);
  });
  it("returns null for a vertical or incomplete line", () => {
    expect(trendPriceAt([{ time: times[1], price: 1 }, { time: times[1], price: 2 }], times, 1)).toBeNull();
    expect(trendPriceAt([pts[0]], times, 1)).toBeNull();
  });
  it("gives the price a drawing represents at a bar", () => {
    const h: Drawing = { id: "h", kind: "hline", points: [{ time: times[1], price: 105 }] };
    const t: Drawing = { id: "t", kind: "trend", points: pts, extend: true };
    expect(drawingPriceAt(h, times, 3)).toBe(105);
    expect(drawingPriceAt(t, times, 4)).toBeCloseTo(120);
    expect(drawingPriceAt({ id: "m", kind: "measure", points: pts }, times, 1)).toBeNull();
  });
});

describe("helpers", () => {
  it("percent from a reference", () => {
    expect(pctFrom(110, 100)).toBeCloseTo(10);
    expect(pctFrom(90, 100)).toBeCloseTo(-10);
    expect(pctFrom(1, 0)).toBeNaN();
  });
  it("formats spans", () => {
    expect(formatSpan(45 * 60)).toBe("45m");
    expect(formatSpan(5 * 3600)).toBe("5h");
    expect(formatSpan(3 * DAY)).toBe("3d");
    expect(formatSpan(28 * DAY)).toBe("4 weeks");
  });
});

describe("parseDrawings", () => {
  const good = { id: "a", kind: "hline", points: [{ time: 1, price: 100 }] };
  it("keeps valid drawings and drops malformed ones", () => {
    const raw = JSON.stringify([good, { id: "b", kind: "trend", points: [{ time: 1, price: 1 }] }, { id: "c", kind: "weird", points: [] }, { ...good, id: "d", points: [{ time: 1, price: -5 }] }]);
    expect(parseDrawings(raw).map((d) => d.id)).toEqual(["a"]);
  });
  it("copes with null, junk and non-arrays", () => {
    expect(parseDrawings(null)).toEqual([]);
    expect(parseDrawings("{oops")).toEqual([]);
    expect(parseDrawings('{"a":1}')).toEqual([]);
  });
  it("accepts a valid trendline and measure", () => {
    const p = [{ time: 1, price: 10 }, { time: 2, price: 20 }];
    expect(parseDrawings(JSON.stringify([{ id: "t", kind: "trend", points: p, extend: true }, { id: "m", kind: "measure", points: p }]))).toHaveLength(2);
  });
});

describe("two-point horizontal lines", () => {
  it("accepts both the old single-point and the new two-point form", () => {
    const p = { time: 100, price: 50 };
    expect(DrawingSchema.safeParse({ id: "a", kind: "hline", points: [p] }).success).toBe(true);
    expect(DrawingSchema.safeParse({ id: "a", kind: "hline", points: [p, { time: 200, price: 50 }] }).success).toBe(true);
    expect(DrawingSchema.safeParse({ id: "a", kind: "trend", points: [p] }).success).toBe(false);
  });
});

describe("new drawing tools", () => {
  it("places one-click tools from a single point", async () => {
    const { placeOnce, DrawingSchema: S } = await import("./drawings");
    const at = { time: 1_700_000_000, price: 100 };
    const h = placeOnce("hline", at, { span: 3600 });
    expect(h.points).toHaveLength(1);
    expect(S.safeParse(h).success).toBe(true);
    const t = placeOnce("text", at, { span: 3600, text: "Breakout" });
    expect(t.text).toBe("Breakout");
  });
  it("builds a long or short position box with its stop and target on the right sides", async () => {
    const { placeOnce, positionStats, DrawingSchema: S } = await import("./drawings");
    const at = { time: 1_700_000_000, price: 200 };
    const long = placeOnce("long", at, { span: 86400, stopPct: 2, targetPct: 4 });
    expect(long.points[1].price).toBeCloseTo(196); expect(long.points[2].price).toBeCloseTo(208);
    expect(long.points[1].time).toBe(long.points[2].time);
    expect(positionStats(long)!.rr).toBeCloseTo(2);
    const short = placeOnce("short", at, { span: 86400, stopPct: 2, targetPct: 4 });
    expect(short.points[1].price).toBeCloseTo(204); expect(short.points[2].price).toBeCloseTo(192);
    expect(positionStats(short)!.rr).toBeCloseTo(2);
    expect(S.safeParse(long).success && S.safeParse(short).success).toBe(true);
  });
  it("computes fibonacci levels from the first point (1) to the second (0)", async () => {
    const { fibPrices } = await import("./drawings");
    const l = fibPrices({ time: 1, price: 100 }, { time: 2, price: 200 });
    expect(l[0]).toEqual({ level: 0, price: 200 });
    expect(l.at(-1)).toEqual({ level: 1, price: 100 });
    expect(l.find((x) => x.level === 0.5)!.price).toBeCloseTo(150);
  });
  it("needs the right number of points for each kind and a valid colour", async () => {
    const { DrawingSchema: S } = await import("./drawings");
    const p = (n: number) => Array.from({ length: n }, (_, i) => ({ time: 100 + i, price: 10 + i }));
    expect(S.safeParse({ id: "a", kind: "channel", points: p(2) }).success).toBe(false);
    expect(S.safeParse({ id: "a", kind: "channel", points: p(3) }).success).toBe(true);
    expect(S.safeParse({ id: "a", kind: "rect", points: p(2), color: "#3b82f6", width: 3, dashed: true }).success).toBe(true);
    expect(S.safeParse({ id: "a", kind: "rect", points: p(2), color: "red" }).success).toBe(false);
    expect(S.safeParse({ id: "a", kind: "vline", points: p(2) }).success).toBe(false);
  });
  it("treats a horizontal ray as a level and a ray like a trendline for price lookups", async () => {
    const { drawingPriceAt } = await import("./drawings");
    const times = [0, 1, 2, 3, 4].map((i) => i * 86400);
    expect(drawingPriceAt({ id: "h", kind: "hray", points: [{ time: 0, price: 50 }] }, times, 3)).toBe(50);
    expect(drawingPriceAt({ id: "r", kind: "ray", points: [{ time: 0, price: 100 }, { time: 2 * 86400, price: 110 }] }, times, 4)).toBeCloseTo(120);
  });
});
