import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildMessages, unknownNumbers } from "@/lib/coach";
import { allow } from "@/lib/server/rate-limit";

const Body = z.object({ kind: z.enum(["portfolio", "idea", "intraday", "backtest"]), data: z.record(z.string(), z.unknown()) });

/**
 * Optional plain-language explanations from a locally run open-source model through Ollama. Off unless OLLAMA_URL is set
 * (for example http://localhost:11434). Only figures already computed by the app are sent, and only to your own machine.
 */
export async function POST(req: NextRequest) {
  const base = process.env.OLLAMA_URL;
  if (!base) return NextResponse.json({ error: "not configured" }, { status: 501 });
  const raw = await req.text();
  if (raw.length > 20_000) return NextResponse.json({ error: "Too much data" }, { status: 413 });
  let parsed;
  try { parsed = Body.safeParse(JSON.parse(raw)); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = allow(`coach:${auth.user.id}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });

  const model = process.env.OLLAMA_MODEL || "llama3.2";
  try {
    const res = await fetch(new URL("/api/chat", base), {
      method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({ model, stream: false, options: { temperature: 0.2 }, messages: buildMessages(parsed.data.kind, parsed.data.data) }),
    });
    if (!res.ok) return NextResponse.json({ error: `The local model returned ${res.status}. Is the model "${model}" pulled?` }, { status: 502 });
    const j = (await res.json()) as { message?: { content?: string } };
    const text = (j.message?.content ?? "").trim();
    if (!text) return NextResponse.json({ error: "The model returned nothing" }, { status: 502 });
    return NextResponse.json({ text, model, unknown: unknownNumbers(text, JSON.stringify(parsed.data.data)) });
  } catch (e) {
    return NextResponse.json({ error: `Could not reach the local model: ${(e as Error).message}` }, { status: 503 });
  }
}
