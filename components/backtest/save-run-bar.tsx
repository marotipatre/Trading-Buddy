"use client";

import { useState } from "react";
import { BookmarkPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Name the current result and save it with its settings. */
export function SaveRunBar({ defaultName, onSave }: { defaultName: string; onSave: (name: string) => Promise<{ error?: string }> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const r = await onSave(name || defaultName);
    setBusy(false);
    if (r.error) toast.error(`Could not save: ${r.error}`);
    else { toast.success("Saved. Find it under Saved runs."); setName(""); }
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2.5">
      <Input className="h-8 min-w-48 flex-1" placeholder={defaultName} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} />
      <Button size="sm" onClick={go} disabled={busy}><BookmarkPlus /> Save this run</Button>
    </div>
  );
}
