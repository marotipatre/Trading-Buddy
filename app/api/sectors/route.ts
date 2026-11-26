import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { allow } from "@/lib/server/rate-limit";
import { loadSectors, type SectorsPayload } from "@/lib/sectors/load";

let cache: { at: number; body: SectorsPayload } | null = null;
let inflight: Promise<SectorsPayload> | null = null;
const TTL = 60 * 60_000; // end-of-day data: an hour is plenty

/** Sector outlook from NSE's official end-of-day index data, cached on the server. */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = allow(`sectors:${auth.user.id}`, 30, 60_000);
  if (!rl.ok) return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });

  if (cache && Date.now() - cache.at < TTL) return NextResponse.json(cache.body);
  try {
    inflight ??= loadSectors().finally(() => { inflight = null; });
    const body = await inflight;
    if (body.sectors.length < 5) throw new Error("NSE returned too little sector data");
    cache = { at: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    if (cache) return NextResponse.json({ ...cache.body, stale: true });
    return NextResponse.json({ error: `Sector data is unavailable right now: ${(e as Error).message}` }, { status: 503 });
  }
}
