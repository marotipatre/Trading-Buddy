import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { allow } from "@/lib/server/rate-limit";
import { loadMarketFeed } from "@/lib/data/market-feed";

/** Every listed NSE equity (about 3,500 with SME) with price, volume and 52-week range, from NSE's official live MCP feed. */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = allow(`market:${auth.user.id}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  try {
    const f = await loadMarketFeed();
    return NextResponse.json({ rows: f.rows, updatedAt: f.updatedAt, stale: f.stale, fallback: f.fallback, source: f.stale ? "NSE official MCP (saved copy)" : f.fallback ? "NSE official end-of-day data (live feed unavailable)" : "NSE official MCP (live, delayed)" });
  } catch (e) {
    return NextResponse.json({ error: `Market list unavailable: ${(e as Error).message}` }, { status: 503 });
  }
}
