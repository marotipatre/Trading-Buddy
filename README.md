# Trading Buddy

Paper trading and strategy backtesting for the Indian stock market (NSE), built with Next.js 16, Supabase and shadcn/ui.

It answers two questions honestly:

1. **What is my probability of winning?** Win rate with a 95% Wilson confidence interval, expectancy, profit factor, a Monte Carlo of your trades (chance of profit, chance of a 50% drawdown), and an in-sample vs out-of-sample split to expose overfitting.
2. **Is my stop-loss really helping?** The same entries are replayed with no stop, your stop and a grid of stops. You get total P&L, drawdown and worst trade for each, how many stopped trades would have recovered, how much loss the stop saved versus profit it gave up, and a max-adverse-excursion chart.

## Features

- **Search**: every NSE and BSE stock (main board and SME) and about 220 indices, about 8,900 instruments, from a local index. It is instant, ranked (exact ticker, name, multi-word, well-known stocks first), and works with the keyboard. Recent and popular symbols show when you focus the box.
- **Explore** (home): index cards, shortcuts by size and sector, a live watchlist with one-tap Buy/Sell, and top movers. Prices paint instantly from the last session, then update.
- **Stocks**: browse about 500 stocks by size class (Large = Nifty 100, Mid = Midcap 150, Small = Smallcap 250) and by NSE sector, with search, and top gainers or losers within a group.
- **Trade**: a live quote, a price chart (candles or line; 1D, 1W, 1M, 6M, 1Y, 5Y, All; volume; hover legend) with your average price, stop-loss, take-profit, pending orders and past trades drawn on it, plus the order ticket (market, limit and stop orders, delivery and intraday, live risk preview).
- **Portfolio**: Holdings, Positions, Orders, Funds and Analysis tabs, laid out like a broker app. Two money pots (Trading and Bank) with add, move and withdraw; returns are measured against the money you put into trading, so deposits never look like profit.
- **Analysis**: win rate with a 95% confidence interval, expectancy in R, stop usage, winners given back, MAE/MFE, tags and notes per trade, and plain-language findings about your own behaviour.
- **Optimizer**: tune the stop-loss distance, hold time or profit target on one stock (with walk-forward) or a whole group. It recommends a value that works across a range of neighbouring values, and shows how it did on the later 30% of history it never saw, so overfitting is visible.
- **Saved runs**: save any backtest, scan or optimization with its settings, load it again later, and compare up to three side by side.
- **Price alerts**: "tell me when RELIANCE rises to 1450", checked while the app is open (and by the watcher if enabled), with an in-app notice and an optional browser notification.
- **Backtester** (`lib/engine`): visual rule builder plus six swing presets, on one stock or on a whole group (size class and/or sector, 5 to 50 stocks) with pooled win probability, how many stocks made money, whether it beat buy-and-hold, and an out-of-sample check. Signals are read at the close and filled at the next open, with pessimistic stop/target ordering, gap handling, trailing and time stops, slippage and Indian transaction charges. Reports win probability, Monte Carlo, in/out-of-sample and a stop-loss study that holds the target fixed so only the stop changes.
- **Chart** (Trade page): candle sizes 5m, 15m, 4H, 1D and 1W; Price, % and Log scales; TradingView-style drawings (horizontal line and trendline as two-point segments, a % ruler) that you can select, drag, reshape and delete, saved per stock; an Indicators menu (EMA, SMA, Bollinger, Supertrend, RSI in its own pane) with a legend and remembered choices.
- **News & broker calls** (Trade page): headlines and broker calls (Jefferies, ICICI Securities, HDFC Securities, Motilal Oswal and others) read from Google News RSS, each linked to its article. Broker calls come from headlines only, so coverage is thin.
- **Ideas**: set an amount, a number of days (7, 15, 30 or your own) and the return you want. It scans large, mid, small or mixed stocks (or all ~500), scores each with a chosen method (trend + strength, Minervini trend template, 12-1 momentum, RSI pullback; daily, weekly or monthly candles), ranks sectors, and shows entry, stop, targets and share count. For each stock it replays the last 3 years to show how often a move of your size happened within your days before the stop, and rolls that into a "what to expect" card. A mixed portfolio spreads picks over sectors, and a Focus list shows stocks in the bullish sectors. A reality-check card cites published return figures.
- **Portfolio review** (Portfolio > My portfolio review): enter your holdings (or import paper holdings) and get weekly performance against the Nifty 50, sector concentration, and a Hold / Add / Trim / Exit view per holding with a stop level.
- **Backtest page**: a Simple (EMA) builder (when to buy, stop below an EMA, target at the next EMA), plus presets and rules including support, resistance and trendline levels from confirmed swing pivots (no lookahead). A chart shows the stock, its averages and every simulated buy and exit. A Monthly & weekly tab shows return per period, trades per period and how many periods reached a goal. Strategies can also run on weekly candles.
- **Intraday**: five picks for the next session (liquid stocks in uptrends that closed strong on rising volume, headline tone checked), each with a buy-stop entry, stop-loss and targets, sized to your risk on a separate 5x margin pot. The pot is its own paper account saved in this browser, with its own P&L, daily results and trade list, and it never touches the main paper account. Hard limits (daily loss %, trades per day, three losses in a row) switch new orders off. Open positions left from an earlier day are settled from that day's 5-minute candles (not today's price); the account is backed up to Supabase (run migration 0004); you can tag mistakes and add notes on each trade, compare each traded pick with what following it exactly would have made, and see an equity curve. A scorecard replays every saved pick on that day's 5-minute candles to show whether the suggestions work, independent of what you traded.
- **Rule books** (Rules): a swing book (14 sections, about 76 rules) and an intraday book (13 sections, about 74 rules), each with a pledge, a pre-trade checklist, numbered rules with the reason for each, setups with exact entry/stop/target, expectancy and drawdown rules, India costs and margin notes, psychology protocols, a staged path from paper to real money, reference tables, calculators (position size, expectancy, losing streaks, recovery, intraday break-even), a monthly scorecard, a side table of contents, search and a reading list. The intraday page enforces its hard limits and counts the rules you tag as broken.
- **Optional AI helpers (all run on your own computer, all off until set up):** FinBERT headline sentiment in the browser (one-time ~110 MB download, switch on from the news panel); plain-language explanations from a local open-source LLM through Ollama (`OLLAMA_URL`, e.g. llama3.2), with a guard that flags any figure the model invents; and an experimental Kronos candlestick forecast through a small local Python service (`scripts/kronos_service.py`, `KRONOS_URL`) that is never used in scores or orders. The pattern follows FinRobot's principle: code computes the numbers, a model only narrates them.
- **Also**: a market-regime check (Nifty vs its 200-day and 50-day averages) that scales suggested sizes, candlestick patterns, a bull-versus-bear case per idea with provenance, a technical snapshot and one-click trade plan on every stock, Ctrl+K quick navigation, a getting-started checklist, and installable-app support (add to home screen).
- **Strategy lab** (Backtest > lab): runs every ready-made strategy on the same stocks and ranks them on the later 30% of history. Our first run (19 large caps, 8 years) found almost every swing strategy lost its edge later and that holding beat them on about 95% of stocks, which is why the app stresses risk control and process over entry signals.
- **Paper broker** (`lib/paper`): shares the backtester's cost model. Stops and targets that triggered while the app was closed are replayed, and intraday positions square off at 15:15 IST.
- **Orders**: market, limit, and stop (trigger) orders. Take-profit and stop-loss exits can be placed on any holding (or edited later with Exits); they are linked, so when one executes the other cancels. Orders are day or GTT (good till triggered, up to a year), execute when the price hits them, fill gaps at the open, and expire on their own. Activity and executions are announced as toasts, including anything that triggered while the app was closed.
- **Data** (`lib/data`): price history and live quotes come from Upstox's open candle endpoints (no login or key needed; NSE stocks and indices, 10 years of daily and years of 5m/15m, plus today's bars), with Moneycontrol, Yahoo and a verified Google Finance page as fallbacks. Every source is cross-checked, previous close is derived from daily bars, and a price is only shown if it can be tied to the requested symbol. Requests are spaced, deduplicated, cached in Supabase and served stale-while-revalidate. CSV import is the last resort.
- Light and dark themes, a mobile bottom tab bar, loading, error and 404 screens.

## Setup

1. Create a Supabase project. In the SQL editor run, in order:
   `supabase/migrations/0001_init.sql` then `supabase/migrations/0002_paper_and_backtests.sql`.
2. Create `.env.local` (git-ignored, never commit it):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

3. `npm install && npm run dev`, open http://localhost:3000 and create an account.

In Supabase, turn off *Confirm email* for local use, and turn off *Allow new users to sign up* once your own account exists.

## Always-on order watcher (optional)

By default your limit, stop-loss and take-profit orders only execute while the app is open (anything that triggered while it was closed is replayed from candles the next time you open it). To have them execute in the background:

1. Run `supabase/migrations/0003_price_alerts.sql` (price alerts) if you have not.
2. Add two values to `.env.local` (never commit this file):

   ```
   SUPABASE_SERVICE_ROLE_KEY=...   # Supabase dashboard > Project Settings > API > service_role
   CRON_SECRET=...                 # any long random string, at least 16 characters
   ```

   **The service-role key has full access to your database.** Keep it only in `.env.local` or your host's secret store; never put it in a `NEXT_PUBLIC_` variable and never share it.
3. Keep the app running and start the watcher in a second terminal: `npm run watch`. It calls `/api/watch` once a minute during market hours.
   If you deploy the app, a scheduler (for example a GitHub Actions cron or any uptime service) can call `GET /api/watch` with the header `Authorization: Bearer <CRON_SECRET>` instead.

How it stays safe: the watcher only touches an account the open app has not saved to for a few minutes (the app saves a heartbeat every minute); every write is conditional on the row not having changed; and if both ever race, the app reloads the latest version instead of overwriting it. It also fires price alerts. The computer running it must be awake and online.

## Scripts

`npm run dev` · `npm run build` · `npm test` · `npm run typecheck` · `npm run lint`

## Limits to keep in mind

- All free market data here is unofficial (Upstox open endpoints, Yahoo, Moneycontrol, a Google Finance page). Any of them can throttle, delay, change or block without notice, and scraping may be against a site's terms; keep usage personal and low-volume. Upload a CSV on the Backtest page if every feed is down.
- Resting orders only run while the app is open. When you open it again, anything that triggered meanwhile is replayed from intraday candles (and logged). There is no always-on server watching prices.
- Keys and logins: none are needed. Upstox's candle and instrument endpoints are open, and nothing here uses your broker account. Upstox's candle endpoints need no login. A real broker sandbox or API token would only be needed for live tick streaming or placing real orders.
- Free intraday history is short (about 59 days for 5m/15m, 7 days for 1m), so swing backtests use daily candles.
- No free historical option data exists, so F&O is not backtested.
- Backtests ignore survivorship bias (today's index members only), liquidity and circuit limits. A small number of trades is statistical noise; the app warns below 30.
- Short selling on NSE cash equity is intraday-only; the schema rejects delivery shorts.
- This is a learning and research tool, not financial advice.

## About the Ideas page

Its scores are fixed, visible rules on price trends, headline wording and published broker calls. They are screens, not predictions, and not investment advice. The "what to expect" figures come from each stock's own past windows, which overlap and mostly come from a rising market, so they flatter results. No rule here can promise a monthly return; published momentum approaches have returned roughly 1.5% a month on average, with losing stretches.

## Sharing it with friends

Everyone who signs in gets their own private paper account (Supabase row-level security keeps accounts apart). To host it for a few people:

1. Create a free Supabase project and run the SQL files in `supabase/migrations/` in order (0001 to 0004) in the SQL editor.
2. Deploy to Vercel (or any Node host): import the repository, set the variables listed in `.env.example` (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Do not put `SUPABASE_SERVICE_ROLE_KEY` anywhere that is not a private server environment.
3. Share the link. On a phone, "Add to Home screen" installs it like an app.

Things to keep in mind when sharing: prices come from free, unofficial sources whose terms and limits can change, so keep the number of users small; the news, coach and forecast routes are rate-limited per user; the optional local AI helpers (Ollama, Kronos) only work on the machine that runs them; and the app is for learning, not advice. Set a license of your choice before inviting contributors.

## Layout

```
app/(app)/            explore, trade, backtest workbench, portfolio
app/api/              candles, quotes, symbols route handlers (proxy to data providers)
components/chart/     price chart, drawings, indicators
components/ideas/     scan, sectors, expectations, focus list
lib/intraday/         next-session picks, margin account, limits, scorecard
lib/playbook/         the two rule books
lib/analysis/         stock scoring, methods, sectors, hit rates, portfolio mix and review, sentiment
components/backtest/  rule builder, risk form, charts, result panels
components/paper/     provider, order ticket, positions, journal, portfolio view
lib/instruments.ts    every NSE/BSE stock and index, with ranked search
lib/engine/           indicators, rules, walkTrade, simulator, costs, metrics, Monte Carlo, stop-loss study
lib/paper/            broker, store, analytics
lib/data/             Yahoo adapter, retry, cache, CSV import
supabase/migrations/  SQL to run in the Supabase editor
```
