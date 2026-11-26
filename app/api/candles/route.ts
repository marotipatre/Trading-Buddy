import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCandles } from "@/lib/data";

const Query = z.object({
  symbol: z.string().min(1).max(30),
  interval: z.enum(["1d", "15m", "5m", "1m"]).default("1d"),
  days: z.coerce.number().int().min(1).max(7300).default(365),
  /** Charts accept a partial cache and refresh in the background; backtests need the full window. */
  fast: z.enum(["0", "1"]).default("0"),
});

const friendly = (msg: string) =>
  /429|HTTP 4\d\d|HTTP 5\d\d|fetch failed|timeout/i.test(msg)
    ? "Price data is temporarily unavailable (the free data source is rate-limiting). Try again in a minute, or upload a CSV on the Backtest page."
    : msg;

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { symbol, interval, days, fast } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const to = Math.floor(Date.now() / 1000);
  try {
    const candles = await getCandles(supabase, symbol, interval, to - days * 86400, to, {
      background: (work) => after(() => work),
      allowPartial: fast === "1",
    });
    return NextResponse.json({ symbol, interval, candles });
  } catch (e) {
    return NextResponse.json({ error: friendly((e as Error).message) }, { status: 503 });
  }
}
