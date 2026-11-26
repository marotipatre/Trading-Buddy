import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PaperState } from "@/lib/paper/types";
import type { AccountRow, AlertRow, WatchStore } from "./watcher";

/** A service-role client (bypasses row-level security). Server only. Returns null when the key is not configured. */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function supabaseWatchStore(admin: SupabaseClient): WatchStore {
  return {
    async listAccounts(): Promise<AccountRow[]> {
      const { data, error } = await admin.from("paper_accounts").select("id,state,updated_at").limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({ id: r.id as string, state: r.state as PaperState, updatedAt: r.updated_at as string }));
    },
    async saveAccount(id, state, expectedUpdatedAt) {
      const { data, error } = await admin.from("paper_accounts")
        .update({ state, updated_at: new Date().toISOString() })
        .eq("id", id).eq("updated_at", expectedUpdatedAt).select("id");
      if (error) throw new Error(error.message);
      return (data?.length ?? 0) > 0;
    },
    async listActiveAlerts(): Promise<AlertRow[]> {
      const { data, error } = await admin.from("price_alerts").select("id,symbol,direction,price").eq("status", "active").limit(1000);
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) return []; // alerts migration not run yet
        throw new Error(error.message);
      }
      return (data ?? []) as AlertRow[];
    },
    async markAlertTriggered(id, price, atSec) {
      const { error } = await admin.from("price_alerts").update({ status: "triggered", triggered_at: new Date(atSec * 1000).toISOString(), triggered_price: price }).eq("id", id).eq("status", "active");
      if (error) throw new Error(error.message);
    },
  };
}
