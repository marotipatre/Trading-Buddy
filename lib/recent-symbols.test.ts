import { describe, it, expect } from "vitest";
import { withRecent } from "./recent-symbols";

describe("withRecent", () => {
  it("puts the newest first and removes duplicates", () => {
    expect(withRecent(["A", "B", "C"], "B")).toEqual(["B", "A", "C"]);
  });
  it("caps the list length", () => {
    expect(withRecent(["A", "B", "C"], "D", 3)).toEqual(["D", "A", "B"]);
  });
  it("works from empty", () => {
    expect(withRecent([], "X")).toEqual(["X"]);
  });
});
