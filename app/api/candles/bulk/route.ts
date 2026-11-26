import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readCache } from "@/lib/data";

/**
 * Cached daily history for many symbols in one request, straight from our database (no call to the price provider).
 * Candles come back as compact rows [time, open, high, low, close, volume]. Symbols that are not cached are simply left out.
 */
export async function GET(req: NextRequest) {
  const symbols = (req.nextUrl.searchParams.get("symbols") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z0-9&_.^-]{1,30}$/.test(s)).slice(0, 30);
  const days = Math.min(3000, Math.max(30, Number(req.nextUrl.searchParams.get("days")) || 800));
  if (!symbols.length) return NextResponse.json({ error: "No symbols" }, { status: 400 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const to = Math.floor(Date.now() / 1000);
  const out: Record<string, number[][]> = {};
  const queue = [...symbols];
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let s = queue.shift(); s !== undefined; s = queue.shift()) {
      try {
        const c = await readCache(supabase, s, "1d", to - days * 86400, to);
        if (c.length) out[s] = c.map((x) => [x.time, x.open, x.high, x.low, x.close, x.volume]);
      } catch { /* leave it out */ }
    }
  }));
  return NextResponse.json({ candles: out });
}
