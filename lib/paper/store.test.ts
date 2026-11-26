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
