"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aiState, aiWanted, disableAi, enableAi, onAiState, type AiState } from "@/lib/analysis/finbert";

/** Switch for the in-browser FinBERT model. Off by default because the first start downloads about 110 MB. */
export function useAi(): AiState {
  // Start from "off" on the server and the first client render so they match; then follow the real state.
  const [s, setS] = useState<AiState>({ status: "off", progress: 0 });
  useEffect(() => {
    const off = onAiState(setS);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with the shared model state after mount
    setS(aiState());
    if (aiWanted() && aiState().status === "off") enableAi().catch(() => undefined); // you switched it on before: reload it from the browser cache
    return off;
  }, []);
  return s;
}

export function AiSentimentToggle({ className }: { className?: string }) {
  const s = useAi();
  if (s.status === "ready") {
    return <span className={className}><span className="inline-flex items-center gap-1 text-xs text-up"><Sparkles className="size-3" /> AI sentiment on (FinBERT, runs in your browser)</span> <button type="button" className="text-xs text-muted-foreground underline" onClick={disableAi}>turn off</button></span>;
  }
  if (s.status === "loading") return <span className={`text-xs text-muted-foreground ${className ?? ""}`}>Loading AI sentiment model… {s.progress ? `${s.progress}%` : ""}</span>;
  return (
    <span className={className}>
      <Button size="xs" variant="outline" onClick={() => enableAi().catch(() => undefined)}><Sparkles /> Enable AI sentiment</Button>
      <span className="ml-2 text-xs text-muted-foreground">{s.status === "error" ? `Could not load: ${s.error}` : "One-time download of about 110 MB, then it runs on your machine. Otherwise a simple word list is used."}</span>
    </span>
  );
}
