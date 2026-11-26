import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { allow } from "@/lib/server/rate-limit";
import { parseScreener, type Fundamentals } from "@/lib/multibagger/fa";

const cache = new Map<string, { at: number; f: Fundamentals | null }>();
const DAY = 24 * 3600_000;
let last = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function one(symbol: string): Promise<Fundamentals | null> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < DAY) return hit.f;
  // Be polite to the source: one page at a time, at least 1.2 seconds apart.
  const wait = last + 1200 - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  let f: Fundamentals | null = null;
  for (const path of ["consolidated/", ""]) {
    try {
      const res = await fetch(`https://www.screener.in/company/${encodeURIComponent(symbol)}/${path}`, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36" }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
      if (res.status === 429) { cache.set(symbol, { at: Date.now() - DAY + 120_000, f: null }); return null; }
      if (!res.ok) continue;
      f = parseScreener(await res.text());
      if (f && (f.sales3y !== undefined || f.profit3y !== undefined || path === "")) break;
    } catch { /* try the standalone page */ }
  }
  cache.set(symbol, { at: Date.now(), f });
  return f;
}

/** Fundamentals for up to 12 stocks per call, read one at a time from public company pages and cached for a day. */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = allow(`fa:${auth.user.id}`, 12, 60_000);
  if (!rl.ok) return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  const symbols = (new URL(req.url).searchParams.get("symbols") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z0-9&_-]{1,20}$/.test(s)).slice(0, 12);
  if (!symbols.length) return NextResponse.json({ error: "No symbols" }, { status: 400 });
  const out: Record<string, Fundamentals | null> = {};
  for (const s of symbols) out[s] = await one(s);
  return NextResponse.json({ data: out, source: "screener.in company pages (public)" });
}
