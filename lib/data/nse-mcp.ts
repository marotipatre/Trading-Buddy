/**
 * A small client for NSE's official, free MCP servers (https://www.nseindia.com/nse-mcp). They speak JSON-RPC over HTTP
 * and need no key: one server serves end-of-day data for about 5,000 listed equities and 150+ indices from NSE's own
 * bhavcopy files, the other serves live data delayed by 1 to 3 minutes.
 *
 * NSE offers this data for information and learning, not commercial use. This client is used server-side only, for a
 * personal learning app, and every screen that shows its data says where it came from.
 */
export const NSE_SERVERS = { eod: "https://mcp.nseindia.in/bhavcopy/cm/mcp", live: "https://mcp.nseindia.in/cmmkt/mcp" } as const;
export type NseServer = keyof typeof NSE_SERVERS;

interface Session { id: string; at: number }
const sessions = new Map<NseServer, Session>();
const SESSION_MS = 15 * 60_000;

const HEADERS = { "content-type": "application/json", accept: "application/json, text/event-stream" };

/** Responses may be plain JSON or a server-sent event ("data: {...}"); return the JSON-RPC object either way. */
export function parseRpc(text: string): { result?: { content?: { type: string; text?: string }[]; isError?: boolean }; error?: { message?: string } } {
  const t = text.trim();
  if (t.startsWith("{")) return JSON.parse(t);
  const line = t.split("\n").map((l) => l.trim()).find((l) => l.startsWith("data:") && l.slice(5).trim().startsWith("{"));
  if (!line) throw new Error("NSE MCP returned an unreadable response");
  return JSON.parse(line.slice(5).trim());
}

async function open(server: NseServer, f: typeof fetch): Promise<string> {
  const cached = sessions.get(server);
  if (cached && Date.now() - cached.at < SESSION_MS) return cached.id;
  const res = await f(NSE_SERVERS[server], {
    method: "POST", headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "trading-buddy-personal", version: "1.0" } } }),
  });
  if (!res.ok) throw new Error(`NSE MCP initialize failed (HTTP ${res.status})`);
  const id = res.headers.get("mcp-session-id");
  if (!id) throw new Error("NSE MCP did not return a session");
  await res.text();
  await f(NSE_SERVERS[server], { method: "POST", headers: { ...HEADERS, "Mcp-Session-Id": id }, cache: "no-store", signal: AbortSignal.timeout(15_000), body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) }).then((r) => r.text()).catch(() => undefined);
  sessions.set(server, { id, at: Date.now() });
  return id;
}

/** Call one tool and return its JSON result. Retries once with a fresh session if the old one expired. */
export async function callTool<T = unknown>(server: NseServer, name: string, args: Record<string, unknown> = {}, f: typeof fetch = fetch): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const id = await open(server, f);
    const res = await f(NSE_SERVERS[server], {
      method: "POST", headers: { ...HEADERS, "Mcp-Session-Id": id }, cache: "no-store", signal: AbortSignal.timeout(40_000),
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }),
    });
    const text = await res.text();
    if ((res.status === 400 || res.status === 404) && attempt === 0) { sessions.delete(server); continue; }
    if (!res.ok) throw new Error(`NSE MCP ${name} failed (HTTP ${res.status})`);
    const rpc = parseRpc(text);
    if (rpc.error) throw new Error(rpc.error.message ?? `NSE MCP ${name} error`);
    const out = rpc.result?.content?.find((c) => c.type === "text")?.text ?? "";
    if (rpc.result?.isError) throw new Error(out.slice(0, 200) || `NSE MCP ${name} returned an error`);
    try { return JSON.parse(out) as T; } catch { throw new Error(`NSE MCP ${name} returned text that is not JSON`); }
  }
  throw new Error(`NSE MCP ${name} could not be reached`);
}

export const _resetSessions = () => sessions.clear();

// ---- typed wrappers for the tools this app uses ----
export interface IndexBar { indexName: string; open?: number; high?: number; low?: number; close: number; pctChange?: number; volume?: number; turnoverCr?: number; pe?: number; pb?: number; divYield?: number; date: string }
export interface IndexHistory { index: string; from_date: string; to_date: string; trading_days: number; data: IndexBar[] }
export interface IndexSnapshot { date: string; indices: IndexBar[] }
export interface Breadth { date: string; total_stocks: number; advances: number; declines: number; unchanged: number; ad_ratio: number; total_volume: number }

export const getIndexHistory = (indexName: string, months: number, f?: typeof fetch) => callTool<IndexHistory>("eod", "get_index_history", { indexName, months }, f);
export const getIndexSnapshot = (f?: typeof fetch) => callTool<IndexSnapshot>("eod", "get_index_snapshot", {}, f);
export const getMarketBreadth = (f?: typeof fetch) => callTool<Breadth>("eod", "get_market_breadth", {}, f);
export const getMarketMood = (f?: typeof fetch) => callTool<Record<string, unknown>>("eod", "get_market_mood", {}, f);

type Eq = { updatedAt?: string; stocks: Record<string, unknown>[] };
const PREFIXES = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"];

/**
 * Every listed equity. The tool returns at most 500 stocks per call, so the list is fetched by symbol prefix (A, B, C...)
 * and any prefix that hits the cap is split into two-letter prefixes.
 */
export async function getAllEquities(f?: typeof fetch, tool: "cm_get_equity_stocks" | "cm_get_sme_stocks" = "cm_get_equity_stocks"): Promise<Eq> {
  const seen = new Map<string, Record<string, unknown>>();
  let updatedAt: string | undefined;
  const grab = async (prefix: string): Promise<void> => {
    const j = await callTool<Eq>("live", tool, { limit: 500, symbolFilter: prefix }, f);
    updatedAt ??= j.updatedAt;
    for (const s of j.stocks) seen.set(String(s.symbol), s);
    if (j.stocks.length >= 500 && prefix.length < 2) await Promise.all(PREFIXES.map((c) => grab(prefix + c)));
  };
  const queue = [...PREFIXES];
  await Promise.all(Array.from({ length: 4 }, async () => { for (let p = queue.shift(); p !== undefined; p = queue.shift()) await grab(p); }));
  return { updatedAt, stocks: [...seen.values()] };
}

/** Official end-of-day quote (from NSE's bhavcopy) for one stock. */
export interface EodQuote { symbol: string; open: number; high: number; low: number; close: number; prev_close: number; volume: number; pct_change?: number; date: string }
/** The tool accepts at most 50 symbols per call. Returns the latest end-of-day figures, each with its own date. */
export async function getBulkQuotes(symbols: string[], f?: typeof fetch): Promise<EodQuote[]> {
  const r = await callTool<{ quotes?: EodQuote[] }>("eod", "get_bulk_quote", { symbols: symbols.slice(0, 50) }, f);
  return r.quotes ?? [];
}
