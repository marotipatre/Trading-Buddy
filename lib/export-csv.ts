import type { ClosedTrade } from "@/lib/paper/types";

const esc = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  // A leading = + - @ can be run as a formula by spreadsheets, so such text gets a leading apostrophe.
  const safe = /^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const iso = (t: number) => new Date(t * 1000).toISOString();

export const TRADE_COLUMNS = ["symbol", "direction", "product", "qty", "entryTime", "entryPrice", "exitTime", "exitPrice", "grossPnl", "charges", "netPnl", "returnPct", "rMultiple", "exitReason", "tags", "note"] as const;

/** Closed trades as CSV text, for a spreadsheet or your own records. */
export function tradesToCsv(trades: ClosedTrade[]): string {
  const rows = trades.map((t) => [t.symbol, t.direction, t.product, t.qty, iso(t.entryTime), t.entryPrice, iso(t.exitTime), t.exitPrice, t.grossPnl.toFixed(2), t.charges.toFixed(2), t.netPnl.toFixed(2), t.returnPct.toFixed(3), t.rMultiple ?? "", t.reason, (t.tags ?? []).join("|"), t.note ?? ""]);
  return [TRADE_COLUMNS.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

/** Save text as a file from the browser. */
export function downloadText(filename: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
