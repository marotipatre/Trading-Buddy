import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { allow } from "@/lib/server/rate-limit";
import { sessionDates } from "@/lib/intraday/picks";
import { computePicks } from "@/lib/server/picks";

export const maxDuration = 60;

/** Day-trade picks for one session, found on the server from saved history. `date` must be today's or the next session. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = allow(`picks:${auth.user.id}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  const s = sessionDates(Math.floor(Date.now() / 1000));
  const date = req.nextUrl.searchParams.get("date") ?? s.next;
  if (date !== s.next && date !== s.today) return NextResponse.json({ error: "Picks are available for today's session and the next one only." }, { status: 400 });
  try {
    return NextResponse.json(await computePicks(supabase, date, req.nextUrl.searchParams.get("refresh") === "1"));
  } catch (e) {
    return NextResponse.json({ error: `Could not find picks: ${(e as Error).message}` }, { status: 503 });
  }
}
