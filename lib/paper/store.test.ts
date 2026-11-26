import { describe, it, expect } from "vitest";
import { isMissingTable } from "./store";

describe("isMissingTable", () => {
  it("recognises Postgres and PostgREST missing-table errors", () => {
    expect(isMissingTable({ code: "42P01" })).toBe(true);
    expect(isMissingTable({ code: "PGRST205" })).toBe(true);
    expect(isMissingTable({ message: 'relation "public.paper_accounts" does not exist' })).toBe(true);
    expect(isMissingTable({ message: "Could not find the table in the schema cache" })).toBe(true);
  });
  it("ignores unrelated errors", () => {
    expect(isMissingTable(null)).toBe(false);
    expect(isMissingTable({ code: "23505", message: "duplicate key" })).toBe(false);
  });
});

import { saveAccount } from "./store";
import { newAccount } from "./broker";

/** A tiny stand-in for the Supabase query builder: update().eq().eq().select() resolves to `result`. */
function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const calls: { eq: [string, unknown][] } = { eq: [] };
  const builder: Record<string, unknown> = {
    update: () => builder,
    eq: (col: string, val: unknown) => { calls.eq.push([col, val]); return builder; },
    select: async () => result,
  };
  return { client: { from: () => builder } as never, calls };
}

describe("saveAccount (optimistic concurrency)", () => {
  const state = newAccount(1000);
  it("guards the write with the last known updated_at and returns the new one", async () => {
    const { client, calls } = fakeClient({ data: [{ updated_at: "2026-01-01T00:00:00.5+00:00" }], error: null });
    const r = await saveAccount(client, { id: "r1", localOnly: false, updatedAt: "old" }, state);
    expect(r).toEqual({ conflict: false, updatedAt: "2026-01-01T00:00:00.5+00:00" });
    expect(calls.eq).toEqual([["id", "r1"], ["updated_at", "old"]]);
  });
  it("reports a conflict when no row matched the expected updated_at", async () => {
    const { client } = fakeClient({ data: [], error: null });
    expect(await saveAccount(client, { id: "r1", localOnly: false, updatedAt: "old" }, state)).toEqual({ conflict: true });
  });
  it("does not call an empty result a conflict when there was no expectation", async () => {
    const { client } = fakeClient({ data: [], error: null });
    expect((await saveAccount(client, { id: "r1", localOnly: false }, state)).conflict).toBe(false);
  });
  it("throws on a database error and skips the database for local-only accounts", async () => {
    const { client } = fakeClient({ data: null, error: { message: "boom" } });
    await expect(saveAccount(client, { id: "r1", localOnly: false, updatedAt: "x" }, state)).rejects.toThrow("boom");
    expect(await saveAccount(client, { localOnly: true }, state)).toEqual({ conflict: false });
  });
});
