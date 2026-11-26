/**
 * Optional AI headline sentiment: FinBERT (a finance-tuned language model) running inside the browser through
 * transformers.js. Nothing is sent to a server: the model (about 110 MB, one time, then cached by the browser) is
 * downloaded from Hugging Face and runs on your own machine. Until it is switched on, the app uses its word-list scorer.
 */
export type AiStatus = "off" | "loading" | "ready" | "error";
export interface AiState { status: AiStatus; progress: number; error?: string }

const KEY = "tb.ai.sentiment";
let state: AiState = { status: "off", progress: 0 };
let classifier: ((texts: string[], opts: { top_k: null }) => Promise<{ label: string; score: number }[][]>) | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<(s: AiState) => void>();
const set = (next: AiState) => { state = next; listeners.forEach((l) => l(state)); };

export const aiState = () => state;
export function onAiState(fn: (s: AiState) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export const aiWanted = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

/** Download (first time) and start the model. Safe to call repeatedly. */
export function enableAi(): Promise<void> {
  try { localStorage.setItem(KEY, "1"); } catch { /* storage unavailable */ }
  if (classifier) return Promise.resolve();
  if (loading) return loading;
  set({ status: "loading", progress: 0 });
  loading = (async () => {
    try {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;
      // Run the model in a background worker so the page stays responsive while it thinks.
      const wasm = (env.backends.onnx as { wasm?: { proxy?: boolean } }).wasm;
      if (wasm) wasm.proxy = true;
      const files = new Map<string, number>();
      const clf = await pipeline("text-classification", "Xenova/finbert", {
        dtype: "q8",
        progress_callback: (p: { status?: string; file?: string; progress?: number }) => {
          if (p.status === "progress" && p.file) {
            files.set(p.file, p.progress ?? 0);
            const big = Math.max(...files.values());
            set({ status: "loading", progress: Math.round(big) });
          }
        },
      });
      classifier = clf as unknown as typeof classifier;
      set({ status: "ready", progress: 100 });
    } catch (e) {
      loading = null;
      set({ status: "error", progress: 0, error: (e as Error).message });
      throw e;
    }
  })();
  return loading;
}

export function disableAi() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  set({ status: "off", progress: 0 });
}

/** Positive minus negative probability for each headline, -1 to 1. Returns null if the model is not ready. */
export async function scoreHeadlines(titles: string[]): Promise<number[] | null> {
  if (!classifier || state.status !== "ready" || !titles.length) return null;
  const out: number[] = [];
  for (let i = 0; i < titles.length; i += 16) {
    const res = await classifier(titles.slice(i, i + 16).map((t) => t.slice(0, 300)), { top_k: null });
    for (const labels of res) {
      const p = (n: string) => labels.find((l) => l.label.toLowerCase() === n)?.score ?? 0;
      out.push(p("positive") - p("negative"));
    }
  }
  return out;
}
