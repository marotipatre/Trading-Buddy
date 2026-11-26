import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Help — Trading Buddy" };

const FAQ: [string, string][] = [
  ["Is this real money?", "No. Every order is simulated with virtual money at live or last-traded prices. Nothing is ever sent to a broker."],
  ["Where does NSE's official MCP data appear?", "NSE publishes free, official MCP servers (end-of-day and live, about 3,000 listed stocks and 150 indices). We use them for the Sector outlook on Ideas (sector index returns, P/E, market breadth, India VIX) and for the Multibagger tab (the whole listed market, with prices and 52-week ranges). NSE provides this for information and learning, not commercial use."],
  ["Where do the financials on the Multibagger tab come from?", "From public company pages on screener.in, one stock at a time and cached for a day, only for the best 36 charts. It is for personal learning, can change or block us, and is never a substitute for reading the company's own filings."],
  ["Where do the prices come from?", "Free, unofficial sources: Upstox's open candle endpoints first, then Moneycontrol, Yahoo and a verified Google Finance page. A price is only shown if it can be tied to the requested symbol. They can be delayed, throttled or wrong, so never use them to place real trades."],
  ["Why do orders only run while the app is open?", "The app runs in your browser. Stops, targets and limit orders are checked every few seconds while it is open, and replayed from candles when you come back. An optional watcher (see the README) can check them while the browser is closed."],
  ["Where is my data stored?", "Your paper account and journal are saved in your Supabase project (private to your login) and cached in your browser. The intraday pot also lives in your browser and is backed up to Supabase once you run migration 0004. Holdings you enter for the portfolio review stay in this browser only."],
  ["Can I trust the ideas and picks?", "Treat them as a way to build a watchlist and plan a trade with a stop. They are fixed rules on price trends, headlines and published broker calls. Our own strategy lab found almost every ready-made swing strategy lost its edge in recent history, and simply holding beat them. The scorecard on the Intraday page measures the picks honestly over time."],
  ["Why does it keep talking about risk and rules?", "Because that is what separates traders who last from those who do not. SEBI's studies found most individual intraday traders lose money, and costs and overtrading are big reasons."],
];

const SHORTCUTS = [["Ctrl K  or  /", "Quick jump to a page or stock"], ["Esc", "Close a dialog, cancel a drawing"], ["Delete", "Remove the selected chart drawing"]];

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Help and about</h1>
        <p className="text-sm text-muted-foreground">What this app is, where its data comes from, and how to set up the optional extras</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Start here</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Read the <Link className="underline" href="/playbook?book=swing">swing rule book</Link>. Ten minutes that will save you money.</li>
            <li>Use <Link className="underline" href="/ideas">Ideas</Link> to find stocks and plan a trade (entry, stop, target, size).</li>
            <li>Open the stock, check the technical snapshot, and place a <b>paper</b> order with a stop-loss. The ticket checks your plan against the rules.</li>
            <li>Test a strategy on history on the <Link className="underline" href="/strategies">Backtest</Link> page, or compare all of them in the <Link className="underline" href="/strategies/lab">lab</Link>.</li>
            <li>For day trading, use the separate 5x pot on the <Link className="underline" href="/intraday">Intraday</Link> page and keep to its daily limits.</li>
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Optional extras (all off by default)</CardTitle><CardDescription>Each runs on your own computer. None is needed to use the app.</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><b>AI headline sentiment (FinBERT).</b> Switch it on from the news panel on any stock. One-time download of about 110 MB; then it runs in your browser.</div>
            <div><b>Plain-language explanations (Ollama).</b> Install <a className="underline" href="https://ollama.com" target="_blank" rel="noreferrer noopener">Ollama</a>, run <code>ollama pull llama3.2</code>, add <code>OLLAMA_URL=http://localhost:11434</code> to <code>.env.local</code>, restart. The model only explains numbers the app computed, and answers with invented figures are flagged.</div>
            <div><b>Price-path experiment (Kronos).</b> Follow the steps at the top of <code>scripts/kronos_service.py</code>, then add <code>KRONOS_URL=http://localhost:8765</code>. Research toy only; never used in scores or orders.</div>
            <div><b>Order watcher.</b> See the README: add <code>SUPABASE_SERVICE_ROLE_KEY</code> and a long random <code>CRON_SECRET</code> to <code>.env.local</code> and run <code>npm run watch</code>.</div>
            <div><b>NSE&apos;s official MCP server.</b> NSE publishes a free, no-key MCP server (35+ tools: stock history, bulk quotes, market breadth, index comparison, 5 years of end-of-day data, intraday delayed by 1 to 3 minutes). It is built to be connected to an AI assistant such as Claude, not to an app. If you use Claude, you can add it as a connector and ask it NSE questions to cross-check what you see here. NSE says the data is for information and learning, not real-time trading or commercial products: read its terms on <a className="underline" href="https://www.nseindia.com/nse-mcp" target="_blank" rel="noreferrer noopener">nseindia.com/nse-mcp</a>.</div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Shortcuts</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">{SHORTCUTS.map(([k, d]) => <div key={k} className="flex justify-between gap-4"><kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">{k}</kbd><span className="text-muted-foreground">{d}</span></div>)}
              <p className="pt-2 text-xs text-muted-foreground">On a phone or desktop you can also install the app: use your browser&apos;s &ldquo;Add to Home screen&rdquo; or &ldquo;Install app&rdquo;.</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Good to know</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm text-muted-foreground">
              <p>Backtests ignore survivorship bias (today&apos;s index members only), liquidity and circuit limits. Fewer than 30 trades is noise.</p>
              <p>Free intraday history is short (about 40 to 60 days), so swing backtests use daily candles.</p>
              <p>For learning only. Nothing here is investment advice.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Questions people ask</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {FAQ.map(([q, a]) => <details key={q} className="group py-3 first:pt-0 last:pb-0"><summary className="cursor-pointer text-sm font-medium">{q}</summary><p className="mt-1.5 text-sm text-muted-foreground">{a}</p></details>)}
        </CardContent>
      </Card>
    </div>
  );
}
