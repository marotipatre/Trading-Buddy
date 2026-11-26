import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/server/supabase-watch-store";
import { allow } from "@/lib/server/rate-limit";
import { getBulkQuotes } from "@/lib/data/nse-mcp";
import { lastUpdate, runDailyUpdate, savedCountFromDb } from "@/lib/data/daily-update";
import { getUniverse } from "@/lib/universe-data";

export const maxDuration = 60;

function cronAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(given), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Saves the latest official close for every listed stock into our price database in about 70 small requests to NSE's
 * MCP feed. Called by the app before big scans (signed-in user) or by a scheduler with CRON_SECRET. Idempotent.
 */
async function handle(req: NextRequest) {
  let supabase;
  if (cronAuthorised(req)) {
    supabase = createAdminClient();
    if (!supabase) return NextResponse.json({ error: "Supabase admin client unavailable" }, { status: 503 });
  } else {
    supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const rl = allow(`daily:${auth.user.id}`, 6, 60_000);
    if (!rl.ok) return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  }
  try {
    const symbols = (await getUniverse()).stocks.map((s) => s.symbol.replace(/\.NS$/, ""));
    const result = await runDailyUpdate(supabase, symbols, { quotes: (s) => getBulkQuotes(s), savedCount: (d) => savedCountFromDb(supabase, d) }, { force: req.nextUrl.searchParams.get("force") === "1" });
    return NextResponse.json({ ...result, source: "NSE official end-of-day data (MCP)" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, last: lastUpdate()?.result }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
