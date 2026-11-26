import type { Candle } from "./types";

export interface CsvResult { candles: Candle[]; skipped: number; warnings: string[] }

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
// 09:15 IST = 03:45 UTC, matching how Yahoo stamps NSE daily bars.
const OPEN_UTC = { h: 3, m: 45 };

/** Parses 2024-03-15, 15-03-2024, 15/03/2024 (day first, as in India) and 15-Mar-2024. Returns unix seconds. */
export function parseDate(raw: string): number | null {
  const s = raw.trim().replace(/^"|"$/g, "");
  let y: number, m: number, d: number;
  let match: RegExpMatchArray | null;
  if ((match = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) { y = +match[1]; m = +match[2] - 1; d = +match[3]; }
  else if ((match = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/))) { d = +match[1]; m = +match[2] - 1; y = +match[3]; }
  else if ((match = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[a-z]*[-\s,]+(\d{4})/))) {
    d = +match[1]; y = +match[3];
    const mi = MONTHS[match[2].toLowerCase()];
    if (mi === undefined) return null;
    m = mi;
  } else return null;
  const t = Date.UTC(y, m, d, OPEN_UTC.h, OPEN_UTC.m);
  const check = new Date(t);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m || check.getUTCDate() !== d) return null; // e.g. 31 Feb
  return t / 1000;
}

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === delim && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

const num = (s: string | undefined) => {
  if (s === undefined) return NaN;
  const t = s.replace(/[,₹\s]/g, "");
  return t === "" || t === "-" ? NaN : Number(t);
};

/** Parse OHLCV CSV (comma, semicolon or tab separated). Header names are matched case-insensitively. */
export function parseCandlesCsv(text: string): CsvResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { candles: [], skipped: 0, warnings: ["The file has no data rows"] };
  const delim = [",", ";", "\t"].map((d) => [d, lines[0].split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const header = splitLine(lines[0], delim).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  const col = {
    date: idx(["date", "timestamp", "time", "datetime", "day"]),
    open: idx(["open", "openprice"]),
    high: idx(["high", "highprice"]),
    low: idx(["low", "lowprice"]),
    close: idx(["close", "closeprice", "ltp", "last"]),
    volume: idx(["volume", "vol", "totaltradedquantity", "ttlTrdQnty".toLowerCase()]),
  };
  const missing = (["date", "open", "high", "low", "close"] as const).filter((k) => col[k] < 0);
  if (missing.length) return { candles: [], skipped: 0, warnings: [`Missing required column(s): ${missing.join(", ")}. Expected Date, Open, High, Low, Close[, Volume].`] };

  const byTime = new Map<number, Candle>();
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, delim);
    const time = parseDate(cells[col.date] ?? "");
    const o = num(cells[col.open]), h = num(cells[col.high]), l = num(cells[col.low]), c = num(cells[col.close]);
    const v = col.volume >= 0 ? num(cells[col.volume]) : 0;
    if (time === null || [o, h, l, c].some((x) => !Number.isFinite(x) || x <= 0) || h < l || h < Math.max(o, c) - 1e-9 || l > Math.min(o, c) + 1e-9) {
      skipped++;
      continue;
    }
    byTime.set(time, { time, open: o, high: h, low: l, close: c, volume: Number.isFinite(v) ? v : 0 });
  }
  const candles = [...byTime.values()].sort((a, b) => a.time - b.time);
  const warnings: string[] = [];
  if (skipped) warnings.push(`${skipped} row(s) were skipped (bad date, non-numeric or inconsistent prices).`);
  if (lines.length - 1 - skipped > candles.length) warnings.push("Duplicate dates were merged (last row wins).");
  if (candles.length && candles.length < 60) warnings.push(`Only ${candles.length} usable candles.`);
  return { candles, skipped, warnings };
}
