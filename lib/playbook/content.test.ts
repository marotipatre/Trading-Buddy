import { describe, it, expect } from "vitest";
import { BOOKS } from "./content";

describe("rule books", () => {
  for (const b of BOOKS) {
    describe(b.title, () => {
      it("has complete, unique sections and no empty entries", () => {
        const titles = b.sections.map((s) => s.title);
        expect(titles.every(Boolean)).toBe(true);
        expect(new Set(titles).size).toBe(titles.length);
        for (const s of b.sections) {
          expect(s.rules.length).toBeGreaterThan(0);
          for (const r of s.rules) { expect(r.rule.length).toBeGreaterThan(15); expect(r.why.length).toBeGreaterThan(15); }
        }
      });
      it("has no repeated rule text", () => {
        const all = b.sections.flatMap((s) => s.rules.map((r) => r.rule));
        expect(new Set(all).size).toBe(all.length);
      });
      it("is rich enough to be a real rule book", () => {
        expect(b.sections.flatMap((s) => s.rules).length).toBeGreaterThanOrEqual(55);
        expect(b.constitution).toHaveLength(10);
        expect(b.setups.length).toBeGreaterThanOrEqual(4);
        expect(b.tables.length).toBeGreaterThanOrEqual(3);
        expect(b.stages.length).toBe(4);
        expect(b.scorecard.length).toBeGreaterThanOrEqual(6);
        expect(b.reading.length).toBeGreaterThanOrEqual(7);
      });
      it("links to real app pages", () => {
        const ok = ["/ideas", "/intraday", "/strategies", "/trade", "/portfolio", "/playbook"];
        for (const s of b.sections) for (const r of s.rules) if (r.inApp) expect(ok.some((p) => r.inApp!.href.startsWith(p))).toBe(true);
      });
    });
  }
});
