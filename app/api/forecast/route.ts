import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCandles } from "@/lib/data";
import { summarizePaths } from "@/lib/forecast";

const Query = z.object({ symbol: z.string().min(1).max(30), days: z.coerce.number().int().min(1).max(30).default(5) });

/**
 * Optional experiment: asks a locally run Kronos service (scripts/kronos_service.py) for sampled price paths.
 * Off unless KRONOS_URL is set. The service address comes only from the server's environment, never from the request.
 */
export async function GET(req: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const base = process.env.KRONOS_URL;
  if (!base) return NextResponse.json({ error: "not configured" }, { status: 501 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const to = Math.floor(Date.now() / 1000);
    const candles = (await getCandles(supabase, parsed.data.symbol, "1d", to - 900 * 86400, to, { background: (w) => after(() => w), allowPartial: true })).slice(-400);
    if (candles.length < 100) return NextResponse.json({ error: "Not enough history" }, { status: 422 });
    const res = await fetch(new URL("/forecast", base), {
      method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({ candles: candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })), pred_len: parsed.data.days, samples: 8 }),
    });
    if (!res.ok) return NextResponse.json({ error: `Forecast service returned ${res.status}` }, { status: 502 });
    const j = (await res.json()) as { closes?: number[][]; model?: string };
    const last = candles[candles.length - 1].close;
    const summary = summarizePaths(j.closes ?? [], last);
    if (!summary) return NextResponse.json({ error: "The service returned no usable forecast" }, { status: 502 });
    return NextResponse.json({ symbol: parsed.data.symbol, lastClose: last, model: j.model ?? "Kronos", ...summary });
  } catch (e) {
    return NextResponse.json({ error: `Forecast unavailable: ${(e as Error).message}` }, { status: 503 });
  }
}
