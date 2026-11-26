import { GLOSSARY } from "@/lib/playbook/glossary";

const lookup = (() => {
  const m = new Map<string, string>();
  for (const t of GLOSSARY) for (const k of [t.term, ...(t.aliases ?? [])]) m.set(k.toLowerCase(), t.means);
  return m;
})();

/** One regular expression matching every glossary word or phrase, longest first, on word boundaries. */
export function termPattern(): RegExp {
  const keys = [...lookup.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"));
  return new RegExp(`(?<![\\w-])(${keys.join("|")})(?![\\w-])`, "gi");
}

export function splitTerms(text: string, re: RegExp): { text: string; term?: string }[] {
  const out: { text: string; term?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i) });
    out.push({ text: m[0], term: lookup.get(m[0].toLowerCase().replace(/\s+/g, " ")) });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

const RE = termPattern();

/** Text in which trading words show a plain-English explanation on hover or tap. Each word is explained once per paragraph. */
export function RichText({ text }: { text: string }) {
  const seen = new Set<string>();
  return (
    <>
      {splitTerms(text, RE).map((p, i) => {
        if (!p.term) return <span key={i}>{p.text}</span>;
        const k = p.text.toLowerCase();
        if (seen.has(k)) return <span key={i}>{p.text}</span>;
        seen.add(k);
        return <abbr key={i} title={p.term} className="cursor-help underline decoration-dotted decoration-muted-foreground/60 underline-offset-2">{p.text}</abbr>;
      })}
    </>
  );
}
