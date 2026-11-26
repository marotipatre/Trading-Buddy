import { describe, it, expect } from "vitest";
import { newer } from "./sync";
import { newIntradayAccount } from "./account";

describe("newer", () => {
  it("prefers the copy saved later, and handles a missing side", () => {
    const a = { ...newIntradayAccount(1000), savedAt: 100 }, b = { ...newIntradayAccount(2000), savedAt: 200 };
    expect(newer(a, b)).toBe(b);
    expect(newer(b, a)).toBe(b);
    expect(newer(null, a)).toBe(a);
    expect(newer(a, null)).toBe(a);
    expect(newer(null, null)).toBeNull();
  });
});
