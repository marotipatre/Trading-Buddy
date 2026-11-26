import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUniverse, sectorsOf } from "@/lib/universe-data";

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const u = await getUniverse();
    return NextResponse.json(
      { stocks: u.stocks, sectors: sectorsOf(u.stocks), asOf: u.asOf },
      { headers: { "Cache-Control": "private, max-age=3600" } },
    );
  } catch (e) {
    return NextResponse.json({ error: `Could not load the stock lists: ${(e as Error).message}` }, { status: 503 });
  }
}
