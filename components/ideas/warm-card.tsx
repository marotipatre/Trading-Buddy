"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScanScope } from "@/lib/universe-lists";

interface Job { running: boolean; scope: ScanScope; total: number; cached: number; done: number; failed: number; paused: boolean }

/** Saves price history in our database in the background so scans stop waiting on the free price provider. */
export function WarmCard({ scope }: { scope: ScanScope | null }) {
  const [job, setJob] = useState<Job | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    const poll = async () => { try { const r = await fetch("/api/warm"); const j = await r.json(); if (alive) setJob(j.job ?? null); } catch { /* ignore */ } };
    const first = setTimeout(poll, 0);
    const id = setInterval(poll, 5000);
    return () => { alive = false; clearTimeout(first); clearInterval(id); };
  }, []);
  async function start() { const r = await fetch("/api/warm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope: scope ?? "n500" }) }); const j = await r.json(); setJob(j.job ?? null); }
  async function stop() { await fetch("/api/warm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cancel: true }) }); }
  const running = job?.running;
  return (
    <div className="text-xs text-muted-foreground">
      <button type="button" className="underline" onClick={() => setOpen((o) => !o)}>{running ? "Saving price history…" : "Make scans faster"}</button>
      {running && job && <span className="ml-2 inline-flex items-center gap-1.5"><Loader2 className="size-3 animate-spin" />{job.paused ? "paused: the price source is limiting requests, retrying" : `${job.cached} of ${job.total} stocks saved`}</span>}
      {open && (
        <div className="mt-2 max-w-xl space-y-2 rounded-lg border bg-card p-3">
          <p>Price history is kept in our database after the first download, so later scans read it from there. The first download of a stock is the slow part: the free price source allows only a limited number of requests (roughly a few thousand per half hour), so about 2,300 stocks can take an hour or more. This saves history for the <b>{scope === "all" ? "whole market" : scope === "n50" ? "Nifty 50" : scope === "m30" ? "Nifty 200 Momentum 30" : "Nifty 500"}</b> in the background; you can keep using the app and stop it any time. Stocks already saved are skipped.</p>
          {running ? <Button size="sm" variant="outline" onClick={() => void stop()}>Stop</Button> : <Button size="sm" onClick={() => void start()}>Save history now</Button>}
          {job && !running && job.total > 0 && <p>Last run: {job.cached} of {job.total} stocks have saved history{job.failed ? `, ${job.failed} could not be loaded` : ""}.</p>}
        </div>
      )}
    </div>
  );
}
