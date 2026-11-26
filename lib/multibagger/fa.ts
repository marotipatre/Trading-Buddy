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
  promoter?: number; promoterChange?: number;
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
  if (promo.length) { f.promoter = promo[promo.length - 1]; f.promoterChange = promo[promo.length - 1] - promo[0]; }
  const borrow = row(t, "Borrowings");
  if (borrow.length) { f.borrowings = borrow[borrow.length - 1]; f.borrowingsChange = borrow[borrow.length - 1] - borrow[Math.max(0, borrow.length - 4)]; }
  const equity = row(t, "Equity Capital"), reserves = row(t, "Reserves");
  if (borrow.length && equity.length && reserves.length) {
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
  let pts = 0, max = 0;
  const add = (w: number, v: number | undefined, good: number, great: number, label: (x: number) => string) => {
    if (v === undefined) return;
    max += w;
    const k = clamp((v - good * 0.4) / (great - good * 0.4), 0, 1);
    pts += w * k;
    if (v >= great) reasons.push(label(v));
  };
  add(22, f.profit3y, 15, 30, (v) => `Profits growing ${v.toFixed(0)}% a year over 3 years`);
  add(15, f.sales3y, 12, 25, (v) => `Sales growing ${v.toFixed(0)}% a year over 3 years`);
  add(10, f.profitTtm, 15, 30, (v) => `Profit up ${v.toFixed(0)}% over the latest 12 months`);
  add(15, f.roce, 15, 25, (v) => `Return on capital employed ${v.toFixed(0)}%`);
  add(8, f.roe, 15, 22, (v) => `Return on equity ${v.toFixed(0)}%`);
  if (f.debtToEquity !== undefined) { max += 10; pts += 10 * clamp(1 - f.debtToEquity / 1.5, 0, 1); if (f.debtToEquity < 0.3) reasons.push("Almost debt free"); }
  if (f.promoter !== undefined) { max += 10; pts += 10 * clamp((f.promoter - 25) / 35, 0, 1); if (f.promoter >= 50) reasons.push(`Promoters own ${f.promoter.toFixed(0)}%`); }
  // Valuation: growth at a sensible price (a PEG below about 1.5 is the usual rule of thumb).
  if (f.pe !== undefined && f.pe > 0 && f.profit3y !== undefined && f.profit3y > 0) {
    const peg = f.pe / f.profit3y; max += 10; pts += 10 * clamp(1 - (peg - 0.8) / 2, 0, 1);
    if (peg < 1.2) reasons.push(`Reasonable price for its growth (P/E ${f.pe.toFixed(0)}, growth ${f.profit3y.toFixed(0)}%)`);
  }
  let score = max ? (pts / max) * 100 : 0;
  if (max < 40) flags.push("Too little fundamental data to judge");
  if (f.pe !== undefined && f.pe <= 0) { flags.push("Loss-making (no positive P/E)"); score -= 20; }
  if (f.pe !== undefined && f.pe > 80) { flags.push(`Very expensive (P/E ${f.pe.toFixed(0)})`); score -= 10; }
  if (f.promoter !== undefined && f.promoter < 25) { flags.push(`Low promoter holding (${f.promoter.toFixed(0)}%)`); score -= 8; }
  if (f.promoterChange !== undefined && f.promoterChange <= -4) { flags.push(`Promoters sold ${Math.abs(f.promoterChange).toFixed(1)} points recently`); score -= 8; }
  if (f.debtToEquity !== undefined && f.debtToEquity > 1.5) { flags.push(`High debt (${f.debtToEquity.toFixed(1)} times equity)`); score -= 12; }
  if (f.profit3y !== undefined && f.profit3y < 0) { flags.push("Profits have shrunk over 3 years"); score -= 12; }
  if (f.mcapCr !== undefined && f.mcapCr < 100) flags.push(`Tiny company (market value ₹${f.mcapCr.toFixed(0)} crore): liquidity and fraud risk`);
  return { score: Math.round(clamp(score)), reasons: reasons.slice(0, 5), flags };
}
