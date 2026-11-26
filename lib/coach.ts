/**
 * A plain-language narrator for numbers the app has already computed. The model is only ever asked to explain figures
 * it is handed: it cannot add prices, returns or odds. `unknownNumbers` then checks its answer and flags any figure that
 * was not in the data, so an invented number is caught instead of trusted.
 */
export type CoachKind = "portfolio" | "idea" | "intraday" | "backtest";

const SYSTEM = [
  "You are a careful trading-education assistant for an Indian paper-trading app.",
  "You are given a JSON object of figures that were computed by code. Explain what they mean in plain, short sentences for a beginner.",
  "Rules: use ONLY numbers that appear in the JSON, copied exactly. Never invent a price, percentage, probability or forecast.",
  "Do not tell the user to buy or sell. Point out risks and what to double-check. If the data is thin, say so.",
  "Write at most 6 short sentences, no headings, no lists, no markdown.",
].join(" ");

const FOCUS: Record<CoachKind, string> = {
  portfolio: "This is a review of the user's holdings: weekly performance, sector concentration and a suggested action per holding. Summarise the main strengths, the main risks and the one thing most worth reviewing.",
  idea: "This is the bull case and bear case for one stock, with its plan and history. Say which side is stronger and why, and what would change the picture.",
  intraday: "This is a day-trading results summary and rule-break counts. Describe what went well, the most costly habit, and one rule to focus on tomorrow.",
  backtest: "This is a strategy backtest summary. Say whether the result looks trustworthy or like luck or overfitting, and why.",
};

export function buildMessages(kind: CoachKind, data: unknown): { role: "system" | "user"; content: string }[] {
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: `${FOCUS[kind]}\n\nFigures (JSON):\n${JSON.stringify(data).slice(0, 6000)}` },
  ];
}

/** Numbers written in a text, as plain numbers: "₹1,24,500" -> 124500, "6.5%" -> 6.5. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * Figures in `answer` that do not appear in `source` (to within rounding). Small whole numbers (0-10) and years are
 * ignored: they are usually counts or dates in ordinary sentences.
 */
export function unknownNumbers(answer: string, source: string): number[] {
  const known = numbersIn(source);
  const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.051, Math.abs(b) * 0.006) || Math.abs(Math.abs(a) - Math.abs(b)) <= 0.051;
  const bad: number[] = [];
  for (const n of numbersIn(answer)) {
    if (Number.isInteger(n) && Math.abs(n) <= 10) continue;
    if (Number.isInteger(n) && n >= 1990 && n <= 2100) continue;
    if (!known.some((k) => near(n, k))) bad.push(n);
  }
  return [...new Set(bad)];
}
