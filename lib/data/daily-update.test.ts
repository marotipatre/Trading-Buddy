import { describe, it, expect, beforeEach, vi } from "vitest";
import { barTs, eodBars, runDailyUpdate, _reset } from "./daily-update";
import type { EodQuote } from "./nse-mcp";

const q = (o: Partial<EodQuote> = {}): EodQuote => ({ symbol: "ABC", open: 100, high: 105, low: 99, close: 104, prev_close: 100, volume: 1000, date: "2026-11-26", ...o });

describe("eodBars", () => {
  it("builds 09:15 IST stamped bars from the newest date only", () => {
    const r = eodBars([q(), q({ symbol: "OLD", date: "2026-11-20" })])!;
    expect(r.date).toBe("2026-11-26");
    expect(r.bars).toHaveLength(1);
    expect(r.bars[0]).toMatchObject({ symbol: "ABC.NS", interval: "1d", ts: "2026-11-26T03:45:00.000Z", open: 100, high: 105, low: 99, close: 104, volume: 1000 });
    expect(barTs("2026-11-26")).toBe(r.bars[0].ts);
  });
  it("drops quotes whose numbers do not hang together instead of repairing them", () => {
    const r = eodBars([q(), q({ symbol: "A", open: 0 }), q({ symbol: "B", high: 98 }), q({ symbol: "C", close: 110 }), q({ symbol: "D", low: 101 })])!;
    expect(r.bars.map((b) => b.symbol)).toEqual(["ABC.NS"]);
    expect(r.dropped).toBe(4);
  });
  it("returns null without dated quotes", () => { expect(eodBars([q({ date: "" })])).toBeNull(); });
});

describe("runDailyUpdate", () => {
  beforeEach(_reset);
  const fake = () => { const calls: number[] = []; const supabase = { from: () => ({ upsert: vi.fn(async (rows: unknown[]) => { calls.push(rows.length); return { error: null }; }) }) }; return { supabase: supabase as never, calls }; };
  const symbols = Array.from({ length: 120 }, (_, i) => `S${i}`);
  const quotes = async (syms: string[]) => syms.map((s) => q({ symbol: s }));

  it("reads the market in chunks of 50 and saves it in bulk", async () => {
    const { supabase, calls } = fake();
    const seen: number[] = [];
    const r = await runDailyUpdate(supabase, symbols, { quotes: async (s) => { seen.push(s.length); return quotes(s); }, savedCount: async () => 0 });
    expect(r.updated).toBe(120);
    expect(seen.filter((n) => n === 50)).toHaveLength(2);
    expect(calls).toEqual([120]);
  });
  it("does nothing when the database already has that date for nearly every stock", async () => {
    const { supabase, calls } = fake();
    const r = await runDailyUpdate(supabase, symbols, { quotes, savedCount: async () => 118 });
    expect(r.skipped).toBe("this date is already saved");
    expect(calls).toHaveLength(0);
  });
  it("shares one run between simultaneous callers", async () => {
    const { supabase } = fake();
    const quotesSpy = vi.fn(quotes);
    const deps = { quotes: quotesSpy, savedCount: async () => 0 };
    const [a, b] = await Promise.all([runDailyUpdate(supabase, symbols, deps), runDailyUpdate(supabase, symbols, deps)]);
    expect(a).toBe(b);
    expect(quotesSpy).toHaveBeenCalledTimes(4); // one probe plus three chunks, once
  });
  it("keeps going when one chunk fails and reports what is missing", async () => {
    const { supabase } = fake();
    let n = 0;
    const r = await runDailyUpdate(supabase, symbols, { quotes: async (s) => { if (s.length === 50 && n++ === 0) throw new Error("rate limited"); return quotes(s); }, savedCount: async () => 0 });
    expect(r.updated).toBe(70);
    expect(r.missing).toBe(50);
  });
  it("reports a save failure instead of pretending", async () => {
    const supabase = { from: () => ({ upsert: async () => ({ error: { message: "boom" } }) }) } as never;
    await expect(runDailyUpdate(supabase, symbols, { quotes, savedCount: async () => 0 })).rejects.toThrow("boom");
  });
});
