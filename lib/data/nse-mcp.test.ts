import { describe, it, expect, beforeEach } from "vitest";
import { callTool, parseRpc, _resetSessions } from "./nse-mcp";

const sse = (obj: unknown) => `event:message\ndata:${JSON.stringify(obj)}\n\n`;
function fakeFetch(handler: (body: { method: string; params?: { name?: string; arguments?: unknown } }, n: number) => { status?: number; body?: string; headers?: Record<string, string> }) {
  let n = 0;
  const calls: { method: string; sid: string | null }[] = [];
  const f = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ method: body.method, sid: (init.headers as Record<string, string>)["Mcp-Session-Id"] ?? null });
    const r = handler(body, n++);
    return new Response(r.body ?? "", { status: r.status ?? 200, headers: r.headers });
  }) as unknown as typeof fetch;
  return { f, calls };
}

beforeEach(_resetSessions);

describe("parseRpc", () => {
  it("reads plain JSON and server-sent events", () => {
    expect(parseRpc('{"jsonrpc":"2.0","id":1,"result":{}}').result).toEqual({});
    expect(parseRpc(sse({ jsonrpc: "2.0", id: 1, result: { content: [] } })).result?.content).toEqual([]);
  });
  it("rejects garbage", () => { expect(() => parseRpc("<html>")).toThrow(); });
});

describe("callTool", () => {
  it("opens a session, calls the tool and parses its JSON text", async () => {
    const { f, calls } = fakeFetch((b) => b.method === "initialize" ? { body: sse({ jsonrpc: "2.0", id: 1, result: {} }), headers: { "mcp-session-id": "abc" } } : b.method === "tools/call" ? { body: sse({ jsonrpc: "2.0", id: 2, result: { content: [{ type: "text", text: '{"advances":10}' }] } }) } : { status: 202 });
    const r = await callTool<{ advances: number }>("eod", "get_market_breadth", {}, f);
    expect(r.advances).toBe(10);
    expect(calls.map((c) => c.method)).toEqual(["initialize", "notifications/initialized", "tools/call"]);
    expect(calls[2].sid).toBe("abc");
  });
  it("reuses the session for later calls", async () => {
    const { f, calls } = fakeFetch((b) => b.method === "initialize" ? { body: sse({ jsonrpc: "2.0", id: 1, result: {} }), headers: { "mcp-session-id": "s1" } } : b.method === "tools/call" ? { body: sse({ jsonrpc: "2.0", id: 2, result: { content: [{ type: "text", text: "{}" }] } }) } : { status: 202 });
    await callTool("eod", "a", {}, f); await callTool("eod", "b", {}, f);
    expect(calls.filter((c) => c.method === "initialize")).toHaveLength(1);
  });
  it("retries once with a new session when the old one is rejected", async () => {
    let sid = 0, tool = 0;
    const { f } = fakeFetch((b) => {
      if (b.method === "initialize") return { body: sse({ jsonrpc: "2.0", id: 1, result: {} }), headers: { "mcp-session-id": `s${++sid}` } };
      if (b.method === "tools/call") return ++tool === 1 ? { status: 404, body: "gone" } : { body: sse({ jsonrpc: "2.0", id: 2, result: { content: [{ type: "text", text: '{"ok":true}' }] } }) };
      return { status: 202 };
    });
    expect(await callTool("eod", "x", {}, f)).toEqual({ ok: true });
    expect(sid).toBe(2);
  });
  it("turns a tool error into an exception", async () => {
    const { f } = fakeFetch((b) => b.method === "initialize" ? { body: sse({ jsonrpc: "2.0", id: 1, result: {} }), headers: { "mcp-session-id": "s" } } : b.method === "tools/call" ? { body: sse({ jsonrpc: "2.0", id: 2, result: { isError: true, content: [{ type: "text", text: "unknown index" }] } }) } : { status: 202 });
    await expect(callTool("eod", "x", {}, f)).rejects.toThrow("unknown index");
  });
});
