import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { allow } from "@/lib/server/rate-limit";
import { getAllEquities } from "@/lib/data/nse-mcp";
import { parseMarket, type MarketRow } from "@/lib/multibagger/market";

let cache: { at: number; rows: MarketRow[]; updatedAt?: string } | null = null;

/** Every listed NSE equity (about 3,000) with price, volume and 52-week range, from NSE's official live MCP feed. */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = allow(`market:${auth.user.id}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  if (cache && Date.now() - cache.at < 5 * 60_000) return NextResponse.json({ rows: cache.rows, updatedAt: cache.updatedAt, source: "NSE official MCP (live, delayed)" });
  try {
    const [main, sme] = await Promise.all([getAllEquities(), getAllEquities(undefined, "cm_get_sme_stocks").catch(() => ({ stocks: [] as Record<string, unknown>[], updatedAt: undefined }))]);
    const j = main;
    const rows = [...parseMarket(main), ...parseMarket(sme, "sme")];
    if (rows.length < 500) throw new Error("NSE returned too few stocks");
    cache = { at: Date.now(), rows, updatedAt: j.updatedAt };
    return NextResponse.json({ rows, updatedAt: j.updatedAt, source: "NSE official MCP (live, delayed)" });
  } catch (e) {
    if (cache) return NextResponse.json({ rows: cache.rows, updatedAt: cache.updatedAt, stale: true, source: "NSE official MCP (saved copy)" });
    return NextResponse.json({ error: `Market list unavailable: ${(e as Error).message}` }, { status: 503 });
  }
}
