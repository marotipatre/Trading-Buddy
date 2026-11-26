import { describe, it, expect, vi } from "vitest";
import { getJsonWithRetry, parseRetryAfter } from "./http";

const res = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const base = { hosts: ["https://a.test", "https://b.test"], sleep: vi.fn(async () => {}), random: () => 1 };

describe("getJsonWithRetry", () => {
  it("returns on first success", async () => {
    const f = vi.fn().mockResolvedValue(res(200, { ok: 1 }));
    expect(await getJsonWithRetry("/x", { ...base, fetchImpl: f })).toEqual({ ok: 1 });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("retries 429 and alternates hosts", async () => {
    const f = vi.fn().mockResolvedValueOnce(res(429)).mockResolvedValueOnce(res(429)).mockResolvedValueOnce(res(200, { ok: 2 }));
    expect(await getJsonWithRetry("/x", { ...base, fetchImpl: f })).toEqual({ ok: 2 });
    expect(f.mock.calls.map((c: unknown[]) => c[0])).toEqual(["https://a.test/x", "https://b.test/x", "https://a.test/x"]);
  });
  it("backs off exponentially", async () => {
    const sleep = vi.fn(async () => {});
    const f = vi.fn().mockResolvedValue(res(503));
    await expect(getJsonWithRetry("/x", { ...base, sleep, retries: 3, fetchImpl: f })).rejects.toThrow("HTTP 503");
    expect(sleep.mock.calls.map((c: unknown[]) => c[0])).toEqual([500, 1000, 2000]);
    expect(f).toHaveBeenCalledTimes(4);
  });
  it("honours Retry-After", async () => {
    const sleep = vi.fn(async () => {});
    const f = vi.fn().mockResolvedValueOnce(res(429, {}, { "retry-after": "3" })).mockResolvedValueOnce(res(200, {}));
    await getJsonWithRetry("/x", { ...base, sleep, fetchImpl: f });
    expect(sleep).toHaveBeenCalledWith(3000);
  });
  it("does not retry non-retryable errors", async () => {
    const f = vi.fn().mockResolvedValue(res(404));
    await expect(getJsonWithRetry("/x", { ...base, fetchImpl: f })).rejects.toThrow("HTTP 404");
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("retries network failures", async () => {
    const f = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(res(200, { ok: 3 }));
    expect(await getJsonWithRetry("/x", { ...base, fetchImpl: f })).toEqual({ ok: 3 });
  });
});

describe("parseRetryAfter", () => {
  it("parses seconds, dates and junk", () => {
    expect(parseRetryAfter("5")).toBe(5000);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6000);
  });
});
