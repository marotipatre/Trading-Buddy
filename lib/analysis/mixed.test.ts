import { describe, it, expect } from "vitest";
import { interleaveMixed } from "./mixed";

describe("interleaveMixed", () => {
  const L = Array.from({ length: 100 }, (_, i) => `L${i}`), M = Array.from({ length: 150 }, (_, i) => `M${i}`), S = Array.from({ length: 250 }, (_, i) => `S${i}`);
  const out = interleaveMixed(L, M, S);
  it("includes every stock exactly once", () => {
    expect(out).toHaveLength(500);
    expect(new Set(out).size).toBe(500);
  });
  it("any leading slice holds all three sizes in about 8:7:5", () => {
    const head = out.slice(0, 20);
    expect(head.filter((x) => x[0] === "L")).toHaveLength(8);
    expect(head.filter((x) => x[0] === "M")).toHaveLength(7);
    expect(head.filter((x) => x[0] === "S")).toHaveLength(5);
  });
  it("copes with empty lists", () => {
    expect(interleaveMixed([], ["m"], [])).toEqual(["m"]);
    expect(interleaveMixed<string>([], [], [])).toEqual([]);
  });
});
