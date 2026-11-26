import { describe, it, expect } from "vitest";
import { prevCloseFromDaily } from "./prev-close";

const IST = 19800;
// 09:15 IST on a given date, the way Yahoo stamps daily bars
const bar = (y: number, m: number, d: number) => Date.UTC(y, m, d, 3, 45) / 1000;
const at = (y: number, m: number, d: number, h: number, mi: number) => Date.UTC(y, m, d, h, mi) / 1000 - IST;

describe("prevCloseFromDaily", () => {
  // The real Nifty case: closes for 19, 20, 23, 25 (24th was a holiday) and the live 26th bar.
  const ts = [bar(2026, 10, 19), bar(2026, 10, 20), bar(2026, 10, 23), bar(2026, 10, 25), bar(2026, 10, 26)];
  const closes = [25514.3, 25800.6, 25349.65, 25819.25, 25884.5];

  it("uses the bar before today's, not a stale range-start close", () => {
    expect(prevCloseFromDaily(ts, closes, at(2026, 10, 26, 15, 29))).toBe(25819.25);
  });
  it("uses the last bar when today's session has not produced a bar yet", () => {
    expect(prevCloseFromDaily(ts.slice(0, 4), closes.slice(0, 4), at(2026, 10, 26, 8, 0))).toBe(25819.25);
  });
  it("on a weekend or holiday the last bar is the previous session", () => {
    expect(prevCloseFromDaily(ts, closes, at(2026, 10, 28, 12, 0))).toBe(25884.5);
  });
  it("skips null closes (halted or missing bars)", () => {
    expect(prevCloseFromDaily(ts, [25514.3, 25800.6, null, 25819.25, 25884.5], at(2026, 10, 26, 12, 0))).toBe(25819.25);
  });
  it("returns undefined with nothing usable", () => {
    expect(prevCloseFromDaily([], [], at(2026, 10, 26, 12, 0))).toBeUndefined();
    expect(prevCloseFromDaily([bar(2026, 10, 26)], [100], at(2026, 10, 26, 12, 0))).toBeUndefined();
  });
});
