import { describe, it, expect } from "vitest";
import { planFromParams, planToQuery } from "./plan-link";

const get = (q: string) => { const p = new URLSearchParams(q); return (k: string) => p.get(k); };
describe("plan link", () => {
  it("round-trips a valid plan", () => {
    const q = planToQuery({ entry: 100.5, stop: 96, target: 110.25 });
    expect(planFromParams(get(q))).toEqual({ entry: 100.5, stop: 96, target: 110.25 });
  });
  it("rejects missing, non-numeric and mis-ordered values", () => {
    expect(planFromParams(get("entry=100&stop=96"))).toBeNull();
    expect(planFromParams(get("entry=abc&stop=96&target=110"))).toBeNull();
    expect(planFromParams(get("entry=100&stop=105&target=110"))).toBeNull();
    expect(planFromParams(get("entry=100&stop=96&target=99"))).toBeNull();
    expect(planFromParams(get("entry=-1&stop=-2&target=0"))).toBeNull();
  });
});
