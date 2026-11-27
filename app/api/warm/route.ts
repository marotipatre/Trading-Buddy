import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCandles } from "@/lib/data";
import { getUniverse } from "@/lib/universe-data";
import { inScope, type ScanScope } from "@/lib/universe-lists";

interface Job { running: boolean; scope: ScanScope; total: number; cached: number; done: number; failed: number; paused: boolean; startedAt: number; finishedAt?: number; cancel: boolean }
let job: Job | null = null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MIN_BARS = 500; // about two years of sessions: enough for every scan the app runs

/**
 * Saves full daily history for the chosen stocks into our database, one stock at a time and politely paced, so scans
 * afterwards read from the database instead of waiting on the free price provider. Safe to stop and start again: stocks
 * that are already saved are skipped. If the provider starts refusing requests the job pauses and tries again.
 */
async function run(supabase: Awaited<ReturnType<typeof createClient>>, j: Job, symbols: string[]) {
  try {
    const missing: string[] = [];
    const queue = [...symbols];
    await Promise.all(Array.from({ length: 8 }, async () => {
      for (let s = queue.shift(); s !== undefined && !j.cancel; s = queue.shift()) {
        const { count, error } = await supabase.from("candles").select("ts", { count: "exact", head: true }).eq("symbol", s).eq("interval", "1d");
        if (error || (count ?? 0) < MIN_BARS) missing.push(s); else j.cached++;
      }
    }));
    j.total = symbols.length;
    let streak = 0, pauses = 0;
    for (const s of missing) {
      if (j.cancel) break;
      try {
        const to = Math.floor(Date.now() / 1000);
        await getCandles(supabase, s, "1d", to - 1900 * 86400, to, {});
        j.cached++; streak = 0; j.paused = false;
      } catch {
        j.failed++; streak++;
        if (streak >= 5 && pauses < 30) { j.paused = true; pauses++; streak = 0; await sleep(120_000); }
      }
      j.done++;
      await sleep(350);
    }
  } finally { j.running = false; j.paused = false; j.finishedAt = Date.now(); }
}

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ job: job && { ...job } });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (job?.running) return NextResponse.json({ job: { ...job } });
  const body = (await req.json().catch(() => ({}))) as { scope?: ScanScope; cancel?: boolean };
  if (body.cancel) { if (job) job.cancel = true; return NextResponse.json({ job: job && { ...job } }); }
  const scope: ScanScope = ["n50", "n200", "n500", "mid", "small", "m30", "all"].includes(body.scope ?? "") ? (body.scope as ScanScope) : "n500";
  const universe = await getUniverse();
  const symbols = universe.stocks.filter((s) => inScope(s, scope)).map((s) => s.symbol);
  const j: Job = { running: true, scope, total: symbols.length, cached: 0, done: 0, failed: 0, paused: false, startedAt: Date.now(), cancel: false };
  job = j;
  after(() => run(supabase, j, symbols));
  return NextResponse.json({ job: { ...j } });
}
