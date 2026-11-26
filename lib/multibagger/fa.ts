/**
 * Fundamentals for a stock, read from its public company page on screener.in (one page per stock, cached for a day).
 * This is the only practical free source for Indian ratios; it is for personal learning use and may change or block us,
 * so every field is optional and the parser fails soft.
 */
export interface Fundamentals {
  name?: string;
  mcapCr?: number; pe?: number; roce?: number; roe?: number; bookValue?: number; divYield?: number;
  /** Compounded growth, percent a year. */
  sales3y?: number; salesTtm?: number; profit3y?: number; profitTtm?: number; roe3y?: number;
  promoter?: number; promoterStart?: number; promoterChange?: number;
  /** Banks, NBFCs and insurers: borrowings and deposits are their raw material, so debt ratios do not apply. */
  financial?: boolean;
  /** Screener shows no P/E when earnings are negative or missing. */
  noPe?: boolean;
  borrowings?: number; borrowingsChange?: number; debtToEquity?: number;
  profitable?: boolean;
}

const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const num = (s?: string) => { if (!s) return undefined; const v = parseFloat(s.replace(/[,₹%\s]/g, "")); return Number.isFinite(v) ? v : undefined; };
const ratio = (t: string, label: string) => num(new RegExp(`${label}\\s*₹?\\s*(-?[\\d,.]+)`).exec(t)?.[1]);
const range = (t: string, block: string, period: string) => num(new RegExp(`${block}[^]*?${period}:?\\s*(-?[\\d.]+)\\s*%`).exec(t)?.[1]);
/** The numbers after a row label, as a list (e.g. the last several quarters or years). */
function row(t: string, label: string): number[] {
  const m = new RegExp(`${label}\\s*\\+?\\s*((?:-?[\\d,.]+%?\\s*){2,})`).exec(t);
  return m ? m[1].trim().split(/\s+/).map((x) => num(x)).filter((x): x is number => x !== undefined) : [];
}

export function parseScreener(html: string): Fundamentals | null {
  const t = text(html);
  if (!/Market Cap|Stock P\/E/.test(t)) return null;
  const f: Fundamentals = {};
  f.name = /^\s*([A-Za-z0-9&.' -]+?(?:Ltd|Limited))/.exec(t)?.[1]?.trim();
  f.mcapCr = ratio(t, "Market Cap"); f.pe = ratio(t, "Stock P/E"); f.roce = ratio(t, "ROCE"); f.roe = ratio(t, "ROE");
  f.bookValue = ratio(t, "Book Value"); f.divYield = ratio(t, "Dividend Yield");
  f.sales3y = range(t, "Compounded Sales Growth", "3 Years"); f.salesTtm = range(t, "Compounded Sales Growth", "TTM");
  f.profit3y = range(t, "Compounded Profit Growth", "3 Years"); f.profitTtm = range(t, "Compounded Profit Growth", "TTM");
  f.roe3y = range(t, "Return on Equity", "3 Years");
  const promo = row(t, "Promoters");
  if (promo.length) { f.promoterStart = promo[0]; f.promoter = promo[promo.length - 1]; f.promoterChange = promo[promo.length - 1] - promo[0]; }
  f.financial = /\b(Deposits|Financing Profit|Interest Earned|Net Interest Income)\b/.test(t);
  f.noPe = f.pe === undefined && f.mcapCr !== undefined;
  const borrow = row(t, "Borrowings");
  if (borrow.length) { f.borrowings = borrow[borrow.length - 1]; f.borrowingsChange = borrow[borrow.length - 1] - borrow[Math.max(0, borrow.length - 4)]; }
  const equity = row(t, "Equity Capital"), reserves = row(t, "Reserves");
  if (!f.financial && borrow.length && equity.length && reserves.length) {
    const net = equity[equity.length - 1] + reserves[reserves.length - 1];
    if (net > 0) f.debtToEquity = borrow[borrow.length - 1] / net;
  }
  return Object.keys(f).length > 1 ? f : null;
}

export interface FaScore { score: number; reasons: string[]; flags: string[] }
const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

/**
 * A fundamental score out of 100 built from what long-run winners in small caps usually show: fast, profitable growth,
 * high returns on capital, low debt, committed owners and a price that has not already run far ahead of earnings.
 * Red flags are listed separately and also cost points.
 */
export function scoreFundamentals(f: Fundamentals): FaScore {
  const reasons: string[] = [], flags: string[] = [];
  const loss = f.noPe === true || (f.pe !== undefined && f.pe <= 0);
  // Growth rates on top of losses or a near-zero base are not meaningful, so they earn little credit when there is no positive P/E.
  const gk = loss ? 0.3 : 1;
  let pts = 0, max = 0;
  const add = (w: number, v: number | undefined, good: number, great: number, label: (x: number) => string, k = 1) => {
    if (v === undefined) return;
    max += w;
    pts += w * clamp((v - good * 0.4) / (great - good * 0.4), 0, 1) * k;
    if (v >= great && k === 1) reasons.push(label(v));
  };
  add(22, f.profit3y, 15, 30, (v) => `Profits grew ${v.toFixed(0)}% a year over 3 years`, gk);
  add(15, f.sales3y, 12, 25, (v) => `Sales grew ${v.toFixed(0)}% a year over 3 years`);
  add(10, f.profitTtm, 15, 30, (v) => `Profit up ${v.toFixed(0)}% over the latest 12 months`, gk);
  add(15, f.roce, 15, 25, (v) => `Return on capital employed ${v.toFixed(0)}%`);
  add(8, f.roe, 15, 22, (v) => `Return on equity ${v.toFixed(0)}%`);
  if (!f.financial && f.debtToEquity !== undefined) { max += 10; pts += 10 * clamp(1 - f.debtToEquity / 1.5, 0, 1); if (f.debtToEquity < 0.3) reasons.push("Borrowings are small against net worth"); }
  if (f.promoter !== undefined) { max += 10; pts += 10 * clamp((f.promoter - 25) / 35, 0, 1); if (f.promoter >= 50) reasons.push(`Promoters hold ${f.promoter.toFixed(0)}%`); }
  // Valuation: P/E against profit growth (a ratio under about 1.2 to 1.5 is the usual rule of thumb, not a law).
  if (f.pe !== undefined && f.pe > 0 && f.profit3y !== undefined && f.profit3y > 0) {
    const peg = f.pe / f.profit3y; max += 10; pts += 10 * clamp(1 - (peg - 0.8) / 2, 0, 1);
    if (peg < 1.2) reasons.push(`P/E ${f.pe.toFixed(0)} against ${f.profit3y.toFixed(0)}% profit growth`);
  }
  let score = max ? (pts / max) * 100 : 0;
  if (max < 40) flags.push("Too little fundamental data to judge");
  if (loss) { flags.push("No positive P/E on screener.in (usually means the last 12 months were loss-making)"); score -= 20; }
  if (f.pe !== undefined && f.pe > 80) { flags.push(`Very high P/E (${f.pe.toFixed(0)})`); score -= 10; }
  if (f.bookValue !== undefined && f.bookValue < 0) { flags.push("Negative book value (liabilities exceed assets)"); score -= 15; }
  if (f.roce !== undefined && f.roce < 0) { flags.push(`Negative return on capital (${f.roce.toFixed(1)}%)`); score -= 8; }
  if (f.promoter !== undefined && f.promoter < 25) flags.push(`Promoter holding is ${f.promoter.toFixed(1)}%`);
  if (f.promoter !== undefined && f.promoter < 25) score -= 8;
  if (f.promoterChange !== undefined && f.promoterStart !== undefined && f.promoterChange <= -4) { flags.push(`Promoter holding fell from ${f.promoterStart.toFixed(1)}% to ${f.promoter!.toFixed(1)}% over the periods shown (can also come from a merger or restructuring)`); score -= 6; }
  if (!f.financial && f.debtToEquity !== undefined && f.debtToEquity > 1.5) { flags.push(`Borrowings are ${f.debtToEquity.toFixed(1)} times net worth`); score -= 12; }
  if (f.profit3y !== undefined && f.profit3y < 0) { flags.push("Profit has shrunk over 3 years"); score -= 12; }
  if (f.mcapCr !== undefined && f.mcapCr < 100) flags.push(`Very small company (market value ₹${f.mcapCr.toFixed(0)} crore): thin trading and limited disclosure are common`);
  return { score: Math.round(clamp(score)), reasons: reasons.slice(0, 5), flags };
}
