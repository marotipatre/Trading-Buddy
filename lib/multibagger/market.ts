/** The whole NSE equity market from NSE's live MCP feed: price, volume and 52-week range for every listed stock. */
export interface MarketRow {
  symbol: string; series: string; segment: "main" | "sme"; price: number; prevClose: number; chgPct: number; volume: number;
  /** Traded value today, in rupees crore. */
  valueCr: number; high52: number; low52: number; chg30d: number | null;
}

const FUND_LIKE = /(BEES|ETF|IETF|LIQUID|GILT|NIFTY|SENSEX|BANKEX|MON100|MOM100|MAFANG|^NV20|^HDFC[A-Z]*(ETF|IETF)|FUND)/;
const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);

/** Pure: keep ordinary equity (series EQ, BE, BL, BT, IL, IQ) and drop ETFs and index funds. */
export function parseMarket(json: { stocks?: Record<string, unknown>[] }, segment: "main" | "sme" = "main"): MarketRow[] {
  const out: MarketRow[] = [];
  for (const s of json.stocks ?? []) {
    const symbol = String(s.symbol ?? ""), series = String(s.series ?? "");
    if (!symbol || !(segment === "sme" ? /^(SM|ST)$/ : /^(EQ|BE|BL|BT|IL|IQ)$/).test(series) || FUND_LIKE.test(symbol)) continue;
    const price = num(s.lastTradedPrice);
    if (price <= 0) continue;
    out.push({
      symbol, series, segment, price, prevClose: num(s.preClosePrice), chgPct: num(s.perChange), volume: num(s.volume), valueCr: num(s.value),
      high52: num(s.fiftyTwoWeekHigh), low52: num(s.fiftyTwoWeekLow), chg30d: typeof s.perChange30d === "number" ? s.perChange30d : null,
    });
  }
  return out;
}
