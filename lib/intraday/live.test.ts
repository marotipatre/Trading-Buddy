import { describe, it, expect } from "vitest";
import { liveStatus, vwap } from "./live";
import type { Candle } from "@/lib/data/types";

const DATE = "2025-03-03";
// 09:15 IST = 03:45 UTC
const t0 = Date.UTC(2025, 2, 3, 3, 45) / 1000;
const bar = (i: number, o: number, h: number, l: number, c: number, v = 1000): Candle => ({ time: t0 + i * 300, open: o, high: h, low: l, close: c, volume: v });
const pick = { forDate: DATE, plan: { entry: 101, stop: 99, target1: 104, target2: 106, risk: 2, riskPct: 2, rr1: 1.5 } };

describe("vwap", () => {
  it("weights typical prices by volume", () => {
    expect(vwap([{ high: 11, low: 9, close: 10, volume: 100 }, { high: 21, low: 19, close: 20, volume: 300 }])).toBeCloseTo(17.5);
    expect(vwap([{ high: 1, low: 1, close: 1, volume: 0 }])).toBeNull();
  });
});

describe("liveStatus", () => {
  it("is null before the session has candles", () => { expect(liveStatus(pick, [])).toBeNull(); });
  it("waits until the entry trades", () => {
    const s = liveStatus(pick, [bar(0, 100, 100.5, 99.8, 100.2), bar(1, 100.2, 100.6, 100, 100.4)])!;
    expect(s.call).toBe("waiting");
  });
  it("calls go when triggered above VWAP and the opening range", () => {
    const bars = [bar(0, 100, 100.4, 99.9, 100.2), bar(1, 100.2, 100.6, 100.1, 100.5), bar(2, 100.5, 100.8, 100.4, 100.7), bar(3, 100.7, 101.4, 100.6, 101.2)];
    const s = liveStatus(pick, bars)!;
    expect(s.call).toBe("go");
    expect(s.orHigh).toBeCloseTo(100.8); // the 9:30 candle has started, so the first 15 minutes are complete
    expect(liveStatus(pick, bars.slice(0, 3))!.orHigh).toBeNull(); // still inside the opening range
    const more = [...bars, bar(4, 101.2, 101.5, 101.1, 101.4), bar(5, 101.4, 101.6, 101.2, 101.5)];
    expect(liveStatus(pick, more)!.orHigh).toBeCloseTo(100.8);
    expect(liveStatus(pick, more)!.call).toBe("go");
  });
  it("calls weak when triggered but under VWAP", () => {
    const bars = [bar(0, 100, 103, 99.9, 102.5, 9000), bar(1, 102.5, 103, 102, 102.4, 9000), bar(2, 102.4, 102.6, 101.9, 102.2, 9000), bar(3, 102, 102.1, 101, 101.2, 100), bar(4, 101.2, 101.3, 101, 101.05, 100)];
    expect(liveStatus({ ...pick, plan: { ...pick.plan, entry: 100.5 } }, bars)!.call).toBe("weak");
  });
  it("tells you not to chase when price is far above the entry", () => {
    const bars = [bar(0, 100.5, 101.2, 100.4, 101.1), bar(1, 101.1, 102.4, 101, 102.3), bar(2, 102.3, 102.9, 102.2, 102.8), bar(3, 102.8, 103, 102.6, 102.9)];
    expect(liveStatus(pick, bars)!.call).toBe("extended");
  });
  it("flags a gap above 1% past the entry and a gap under the stop", () => {
    expect(liveStatus(pick, [bar(0, 103, 103.5, 102.8, 103.2)])!.call).toBe("skip-gap");
    expect(liveStatus(pick, [bar(0, 98, 98.5, 97, 97.5)])!.call).toBe("skip-gap");
  });
  it("reports a stop out and a target", () => {
    expect(liveStatus(pick, [bar(0, 100.8, 101.2, 100.7, 101), bar(1, 101, 101.1, 98.5, 98.8)])!.call).toBe("stopped");
    expect(liveStatus(pick, [bar(0, 100.8, 101.2, 100.7, 101), bar(1, 101, 104.2, 101, 103.9)])!.call).toBe("target");
  });
});
