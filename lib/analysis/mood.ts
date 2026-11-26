import { aiState, scoreHeadlines } from "./finbert";
import { moodFromScores, newsMood, type NewsMood } from "./sentiment";

/** Headline mood from the AI model when it is switched on and ready, otherwise from the word list. */
export async function moodOf(items: { title: string; time: number }[]): Promise<NewsMood & { source: "ai" | "words" }> {
  if (aiState().status === "ready") {
    try {
      const scores = await scoreHeadlines(items.map((i) => i.title));
      if (scores) return { ...moodFromScores(items, scores), source: "ai" };
    } catch { /* fall back to the word list */ }
  }
  return { ...newsMood(items), source: "words" };
}
