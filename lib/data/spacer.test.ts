import { describe, it, expect, vi } from "vitest";
import { createSpacer, dedupe } from "./spacer";

describe("createSpacer", () => {
  it("runs tasks serially with a minimum gap between starts", async () => {
    let t = 0;
    const sleeps: number[] = [];
    const run = createSpacer({ minGapMs: 400, now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms; } });
    const starts: number[] = [];
    await Promise.all([1, 2, 3].map((i) => run(async () => { starts.push(t); return i; })));
    expect(starts).toEqual([0, 400, 800]);
    expect(sleeps).toEqual([400, 400]);
  });
  it("does not delay when enough time has already passed", async () => {
    let t = 0;
    const sleep = vi.fn(async () => {});
    const run = createSpacer({ minGapMs: 100, now: () => t, sleep });
    await run(async () => 1);
    t = 1000;
    await run(async () => 2);
    expect(sleep).not.toHaveBeenCalled();
  });
  it("a failing task does not block later ones and still rejects its caller", async () => {
    const run = createSpacer({ minGapMs: 0, sleep: async () => {} });
    await expect(run(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(await run(async () => "ok")).toBe("ok");
  });
  it("preserves order", async () => {
    const run = createSpacer({ minGapMs: 0, sleep: async () => {} });
    const order: number[] = [];
    await Promise.all([run(async () => { order.push(1); }), run(async () => { order.push(2); }), run(async () => { order.push(3); })]);
    expect(order).toEqual([1, 2, 3]);
  });
});

describe("dedupe", () => {
  it("shares one call between identical concurrent requests, then allows a fresh one", async () => {
    const d = dedupe<number>();
    const make = vi.fn(async () => 7);
    const [a, b] = await Promise.all([d("k", make), d("k", make)]);
    expect([a, b]).toEqual([7, 7]);
    expect(make).toHaveBeenCalledTimes(1);
    await d("k", make);
    expect(make).toHaveBeenCalledTimes(2);
  });
  it("keeps different keys separate", async () => {
    const d = dedupe<string>();
    const make = vi.fn(async () => "x");
    await Promise.all([d("a", make), d("b", make)]);
    expect(make).toHaveBeenCalledTimes(2);
  });
});
