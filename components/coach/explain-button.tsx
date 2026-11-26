"use client";

import { useState } from "react";
import { Loader2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CoachKind } from "@/lib/coach";

/** "Explain in plain words": a local open-source model narrates figures the app computed. Optional, off until set up. */
export function ExplainButton({ kind, data, label = "Explain in plain words" }: { kind: CoachKind; data: Record<string, unknown>; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ text?: string; error?: string; unknown?: number[]; model?: string } | null>(null);
  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, data }) });
      setOut(await res.json());
    } catch (e) { setOut({ error: (e as Error).message }); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={run} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <MessageSquareText />}{busy ? "Thinking on your computer…" : label}</Button>
      {out?.error === "not configured" && <p className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">Local AI is not set up. Install <a className="underline" href="https://ollama.com" target="_blank" rel="noreferrer noopener">Ollama</a>, run <code>ollama pull llama3.2</code>, add <code>OLLAMA_URL=http://localhost:11434</code> to <code>.env.local</code> and restart the app. It runs on your machine and only sees figures this app already computed.</p>}
      {out?.error && out.error !== "not configured" && <p className="text-xs text-down">{out.error}</p>}
      {out?.text && (
        <div className="space-y-1.5 rounded-lg border bg-card p-3 text-sm">
          <p>{out.text}</p>
          {out.unknown && out.unknown.length > 0 && <p className="text-xs text-warn">Careful: this answer contains figures that are not in your data ({out.unknown.join(", ")}). Ignore those.</p>}
          <p className="text-[11px] text-muted-foreground">Written by {out.model} running locally. It only explains the numbers shown; it does not know the future.</p>
        </div>
      )}
    </div>
  );
}
