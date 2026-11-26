import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { quoteService } from "@/lib/data/quotes";

export async function GET(req: NextRequest) {
  const symbols = [...new Set(
    (req.nextUrl.searchParams.get("symbols") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  )].slice(0, 50);
  if (!symbols.length) return NextResponse.json({ quotes: [] });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quotes = await quoteService.getQuotes(symbols);
  return NextResponse.json({ quotes, missing: symbols.filter((s) => !quotes.some((q) => q.symbol === s)) });
}
