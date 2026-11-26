import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getInstruments, searchInstruments } from "@/lib/instruments";
import { searchSymbols } from "@/lib/data/yahoo";
import { POPULAR_STOCKS, INDICES } from "@/lib/universe";
import { getUniverse } from "@/lib/universe-data";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 1) return NextResponse.json({ results: [] });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // The full local index of NSE and BSE stocks and indices: instant, and independent of any web service.
    // Well-known stocks (the Nifty 500 plus our popular list) win ties against obscure look-alikes.
    const boost = new Set<string>([...POPULAR_STOCKS, ...INDICES].map((i) => i.symbol));
    try { (await getUniverse()).stocks.forEach((s) => boost.add(s.symbol)); } catch {}
    const hits = searchInstruments(await getInstruments(), q, 12, boost);
    return NextResponse.json({
      results: hits.map((i) => ({ symbol: i.symbol, name: i.name, exchange: i.kind === "index" ? "INDEX" : i.exchange })),
      source: "local",
    });
  } catch {
    try {
      return NextResponse.json({ results: await searchSymbols(q), source: "yahoo" });
    } catch (e) {
      return NextResponse.json({ error: `Search is unavailable right now: ${(e as Error).message}` }, { status: 503 });
    }
  }
}
