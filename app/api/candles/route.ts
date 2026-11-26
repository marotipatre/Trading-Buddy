import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCandles } from "@/lib/data";

const Query = z.object({
  symbol: z.string().min(1).max(30),
  interval: z.enum(["1d", "15m", "5m", "1m"]).default("1d"),
  days: z.coerce.number().int().min(1).max(7300).default(365),
});

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { symbol, interval, days } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const to = Math.floor(Date.now() / 1000);
  try {
    const candles = await getCandles(supabase, symbol, interval, to - days * 86400, to);
    return NextResponse.json({ symbol, interval, candles });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
