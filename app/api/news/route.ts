import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consensus, fetchCompanyNews } from "@/lib/data/news";

const cache = new Map<string, { at: number; body: unknown }>();
const TTL = 10 * 60_000;

export async function GET(req: NextRequest) {
  const name = (req.nextUrl.searchParams.get("name") ?? "").trim().slice(0, 60);
  const price = Number(req.nextUrl.searchParams.get("price")) || undefined;
  if (name.length < 2) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = name.toLowerCase();
  const hit = cache.get(key);
  let raw = hit && Date.now() - hit.at < TTL ? (hit.body as Awaited<ReturnType<typeof fetchCompanyNews>>) : null;
  if (!raw) {
    try {
      raw = await fetchCompanyNews(name);
      cache.set(key, { at: Date.now(), body: raw });
    } catch (e) {
      return NextResponse.json({ error: `News is unavailable right now: ${(e as Error).message}` }, { status: 503 });
    }
  }
  const c = consensus(raw.calls, price);
  return NextResponse.json({ news: raw.news, calls: c.latest, allCalls: raw.calls.length, summary: c.summary });
}
