import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTable } from "@/lib/paper/store";
import type { IntradayAccount } from "./account";

export interface Remote { acc: IntradayAccount | null; missing: boolean }

/** The saved copy in Supabase, if the table exists. `missing` means migration 0004 has not been run. */
export async function loadRemote(supabase: SupabaseClient): Promise<Remote> {
  const { data, error } = await supabase.from("intraday_accounts").select("data").limit(1).maybeSingle();
  if (error) {
    if (isMissingTable(error)) return { acc: null, missing: true };
    return { acc: null, missing: false };
  }
  const acc = (data?.data ?? null) as IntradayAccount | null;
  return { acc: acc?.v === 1 && acc.state?.version === 1 ? acc : null, missing: false };
}

export async function saveRemote(supabase: SupabaseClient, acc: IntradayAccount): Promise<{ error?: string; missing?: boolean }> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Not signed in" };
  const { error } = await supabase.from("intraday_accounts").upsert({ user_id: u.user.id, data: acc, saved_at: acc.savedAt ?? Date.now(), updated_at: new Date().toISOString() });
  if (error) return isMissingTable(error) ? { missing: true } : { error: error.message };
  return {};
}

/** The newer of two copies (by `savedAt`). */
export function newer(a: IntradayAccount | null, b: IntradayAccount | null): IntradayAccount | null {
  if (!a) return b;
  if (!b) return a;
  return (b.savedAt ?? 0) > (a.savedAt ?? 0) ? b : a;
}
