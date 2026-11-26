import { describe, it, expect } from "vitest";
import { GLOSSARY } from "./glossary";
import { termPattern, splitTerms } from "@/components/playbook/rich-text";

describe("glossary", () => {
  it("has a plain meaning for every term and no duplicates", () => {
    const all = GLOSSARY.flatMap((t) => [t.term, ...(t.aliases ?? [])].map((x) => x.toLowerCase()));
    expect(new Set(all).size).toBe(all.length);
    for (const t of GLOSSARY) expect(t.means.length).toBeGreaterThan(25);
  });
  it("finds terms in text, longest first, without cutting words apart", () => {
    const parts = splitTerms("Place a stop-loss and trade with margin. Pullbacks in an uptrend, not breakouts of a trailing stop.", termPattern());
    const found = parts.filter((p) => p.term).map((p) => p.text.toLowerCase());
    expect(found).toContain("stop-loss");
    expect(found).toContain("margin");
    expect(found).toContain("pullbacks");
    expect(found).toContain("trailing stop");
    expect(splitTerms("stopping the target date", termPattern()).filter((p) => p.term).map((p) => p.text.toLowerCase())).toEqual(["target"]);
  });
});
