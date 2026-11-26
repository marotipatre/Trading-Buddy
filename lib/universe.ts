/** Popular NSE stocks and indices with the names brokers show. Used for display and quick-add; not an index membership list. */
export interface Instrument { symbol: string; name: string }

export const INDICES: Instrument[] = [
  { symbol: "^NSEI", name: "NIFTY 50" },
  { symbol: "^NSEBANK", name: "BANK NIFTY" },
  { symbol: "^BSESN", name: "SENSEX" },
  { symbol: "^CNXIT", name: "NIFTY IT" },
];

const S = (t: string, name: string): Instrument => ({ symbol: `${t}.NS`, name });

export const POPULAR_STOCKS: Instrument[] = [
  S("RELIANCE", "Reliance Industries"), S("TCS", "Tata Consultancy Services"), S("HDFCBANK", "HDFC Bank"), S("INFY", "Infosys"),
  S("ICICIBANK", "ICICI Bank"), S("BHARTIARTL", "Bharti Airtel"), S("SBIN", "State Bank of India"), S("ITC", "ITC"),
  S("HINDUNILVR", "Hindustan Unilever"), S("LT", "Larsen & Toubro"), S("KOTAKBANK", "Kotak Mahindra Bank"), S("AXISBANK", "Axis Bank"),
  S("BAJFINANCE", "Bajaj Finance"), S("MARUTI", "Maruti Suzuki India"), S("SUNPHARMA", "Sun Pharmaceutical"), S("TITAN", "Titan Company"),
  S("ASIANPAINT", "Asian Paints"), S("ULTRACEMCO", "UltraTech Cement"), S("WIPRO", "Wipro"), S("HCLTECH", "HCL Technologies"),
  S("NTPC", "NTPC"), S("POWERGRID", "Power Grid Corporation"), S("ONGC", "Oil & Natural Gas Corporation"), S("TATAMOTORS", "Tata Motors"),
  S("TATASTEEL", "Tata Steel"), S("JSWSTEEL", "JSW Steel"), S("M&M", "Mahindra & Mahindra"), S("ADANIENT", "Adani Enterprises"),
  S("ADANIPORTS", "Adani Ports & SEZ"), S("COALINDIA", "Coal India"), S("NESTLEIND", "Nestle India"), S("TECHM", "Tech Mahindra"),
  S("INDUSINDBK", "IndusInd Bank"), S("BAJAJFINSV", "Bajaj Finserv"), S("GRASIM", "Grasim Industries"), S("CIPLA", "Cipla"),
  S("DRREDDY", "Dr. Reddy's Laboratories"), S("EICHERMOT", "Eicher Motors"), S("HEROMOTOCO", "Hero MotoCorp"), S("HINDALCO", "Hindalco Industries"),
  S("APOLLOHOSP", "Apollo Hospitals"), S("BRITANNIA", "Britannia Industries"), S("TATACONSUM", "Tata Consumer Products"), S("SBILIFE", "SBI Life Insurance"),
  S("HDFCLIFE", "HDFC Life Insurance"), S("SHRIRAMFIN", "Shriram Finance"), S("BPCL", "Bharat Petroleum"), S("JIOFIN", "Jio Financial Services"),
  S("TRENT", "Trent"), S("BEL", "Bharat Electronics"),
];

export const DEFAULT_WATCHLIST: Instrument[] = [
  ...INDICES.slice(0, 2), ...POPULAR_STOCKS.slice(0, 8),
];
