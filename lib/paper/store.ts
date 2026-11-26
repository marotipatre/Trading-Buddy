import type { SupabaseClient } from "@supabase/supabase-js";
import { newAccount } from "./broker";
import { normalizeState } from "./funds";
import type { PaperState } from "./types";

const LOCAL_KEY = "trading-buddy:paper-account:v1";

export interface Loaded {
  state: PaperState;
  /** Row id when backed by Supabase. */
  id?: string;
  /** True when the paper_accounts table is missing, so state lives in this browser only. */
  localOnly: boolean;
}

function readLocal(): PaperState | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const s = raw ? (JSON.parse(raw) as PaperState) : null;
    return s?.version === 1 ? s : null;
  } catch {
    return null;
  }
}

export function writeLocal(state: PaperState) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  } catch {}
}

/** Table-not-found errors from PostgREST / Postgres. */
export function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === "42P01" || err.code === "PGRST205" || /does not exist|schema cache/i.test(err.message ?? "");
}

export async function loadAccount(supabase: SupabaseClient): Promise<Loaded> {
  const { data, error } = await supabase.from("paper_accounts").select("id,state").limit(1).maybeSingle();
  if (error) {
    if (isMissingTable(error)) return { state: normalizeState(readLocal() ?? newAccount()), localOnly: true };
    throw new Error(error.message);
  }
  if (data) return { id: data.id as string, state: normalizeState(data.state as PaperState), localOnly: false };
  const fresh = normalizeState(readLocal() ?? newAccount());
  const ins = await supabase.from("paper_accounts").insert({ state: fresh }).select("id").single();
  if (ins.error) throw new Error(ins.error.message);
  return { id: ins.data.id as string, state: fresh, localOnly: false };
}

export async function saveAccount(supabase: SupabaseClient, loaded: Pick<Loaded, "id" | "localOnly">, state: PaperState): Promise<void> {
  writeLocal(state); // always keep a local copy as a safety net
  if (loaded.localOnly || !loaded.id) return;
  const { error } = await supabase.from("paper_accounts").update({ state, updated_at: new Date().toISOString() }).eq("id", loaded.id);
  if (error) throw new Error(error.message);
}
