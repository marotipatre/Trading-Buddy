/**
 * Headline sentiment from a finance word list. Deliberately simple and transparent: every score can be traced to
 * the words that produced it. It reads headlines only, so treat it as a tilt, not a verdict.
 */
const POS = ["surge", "surges", "jumps", "jump", "rallies", "rally", "gains", "gain", "soars", "beats", "beat", "record", "strong", "upgrade", "upgrades", "upgraded", "outperform", "buy", "bullish", "growth", "profit", "wins", "order win", "bags", "approval", "raises", "boost", "rises", "rise", "positive", "re-rating", "expansion", "dividend", "bonus", "recovery", "breakout", "target raised"];
const NEG = ["falls", "fall", "drops", "drop", "plunges", "plunge", "slumps", "slump", "crashes", "crash", "misses", "miss", "weak", "downgrade", "downgrades", "downgraded", "underperform", "sell", "bearish", "loss", "losses", "probe", "fraud", "penalty", "fine", "cuts", "cut", "decline", "declines", "negative", "concern", "concerns", "default", "raid", "ban", "slowdown", "pressure", "target cut", "warning", "lawsuit"];

const rx = (words: string[]) => new RegExp(`(?<![a-z])(${words.map((w) => w.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|")})(?![a-z])`, "gi");
const POS_RE = rx(POS), NEG_RE = rx(NEG);

/** -1 (very negative) to +1 (very positive). */
export function headlineScore(title: string): number {
  const pos = title.match(POS_RE)?.length ?? 0;
  const neg = title.match(NEG_RE)?.length ?? 0;
  return pos + neg === 0 ? 0 : (pos - neg) / (pos + neg);
}

export interface NewsMood { score: number; positive: number; negative: number; neutral: number; count: number }

/** Average headline score, newer headlines counting more (half weight at one week old). */
export function newsMood(items: { title: string; time: number }[], now = Date.now() / 1000): NewsMood {
  let sum = 0, wsum = 0, positive = 0, negative = 0, neutral = 0;
  for (const it of items) {
    const s = headlineScore(it.title);
    const w = Math.pow(0.5, Math.max(0, now - it.time) / (7 * 86400));
    sum += s * w; wsum += w;
    if (s > 0.2) positive++; else if (s < -0.2) negative++; else neutral++;
  }
  return { score: wsum ? sum / wsum : 0, positive, negative, neutral, count: items.length };
}
