import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { historyService } from "@/lib/data/history";
import { quoteService } from "@/lib/data/quotes";
import { createAdminClient, supabaseWatchStore } from "@/lib/server/supabase-watch-store";
import { inWatchWindow, runWatcher, type WatchData } from "@/lib/server/watcher";

export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false; // refuse to run with a missing or guessable secret
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: NextRequest) {
  if (!process.env.CRON_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "The order watcher is not configured. Set CRON_SECRET and SUPABASE_SERVICE_ROLE_KEY (see the README)." }, { status: 503 });
  }
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = Math.floor(Date.now() / 1000);
  if (!inWatchWindow(now) && req.nextUrl.searchParams.get("force") !== "1") {
    return NextResponse.json({ skipped: "outside market hours (use ?force=1 to run anyway)" });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase admin client unavailable" }, { status: 503 });

  const data: WatchData = {
    quotes: (symbols) => quoteService.getQuotes(symbols),
    bars: async (symbol, from, to) => (await historyService.get(symbol, "15m", from, to)).candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })),
  };
  try {
    return NextResponse.json(await runWatcher(supabaseWatchStore(admin), data, now));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
