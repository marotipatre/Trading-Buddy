import { describe, it, expect, beforeEach } from "vitest";
import { allow, _resetForTests } from "./rate-limit";

beforeEach(_resetForTests);
describe("rate limit", () => {
  it("allows up to the limit then refuses with a wait time", () => {
    for (let i = 0; i < 3; i++) expect(allow("u1", 3, 60_000, 1000).ok).toBe(true);
    const r = allow("u1", 3, 60_000, 2000);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBe(59);
  });
  it("keeps users separate and resets after the window", () => {
    for (let i = 0; i < 3; i++) allow("u1", 3, 60_000, 0);
    expect(allow("u2", 3, 60_000, 0).ok).toBe(true);
    expect(allow("u1", 3, 60_000, 61_000).ok).toBe(true);
  });
});
