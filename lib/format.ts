const dash = "—";

export function fmtInr(x: number, opts: { sign?: boolean } = {}): string {
  if (!Number.isFinite(x)) return dash;
  const s = `₹${Math.abs(Math.round(x)).toLocaleString("en-IN")}`;
  if (x < 0) return `-${s}`;
  return opts.sign && x > 0 ? `+${s}` : s;
}

export function fmtPct(x: number, digits = 1, opts: { sign?: boolean } = {}): string {
  if (x === Infinity) return "∞";
  if (!Number.isFinite(x)) return dash;
  const s = x.toFixed(digits);
  return opts.sign && x > 0 ? `+${s}%` : `${s}%`;
}

export function fmtNum(x: number, digits = 2): string {
  if (x === Infinity) return "∞";
  return Number.isFinite(x) ? x.toFixed(digits) : dash;
}

/** Unix seconds -> "12 Mar 2024" in IST. */
export function fmtDate(sec: number): string {
  return new Date(sec * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}
