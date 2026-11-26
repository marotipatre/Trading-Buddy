# Trading Buddy

Paper trading and strategy backtesting for the Indian stock market (NSE), built with Next.js 16, Supabase and shadcn/ui.

It answers two questions honestly:

1. **What is my probability of winning?** Win rate with a 95% Wilson confidence interval, expectancy, profit factor, a Monte Carlo of your trades (chance of profit, chance of a 50% drawdown), and an in-sample vs out-of-sample split to expose overfitting.
2. **Is my stop-loss really helping?** The same entries are replayed with no stop, your stop and a grid of stops. You get total P&L, drawdown and worst trade for each, how many stopped trades would have recovered, how much loss the stop saved versus profit it gave up, and a max-adverse-excursion chart.

## Features

- **Explore** (home): index cards, a live watchlist with one-tap Buy/Sell, and top movers among popular stocks. Prices paint instantly from the last session, then update.
- **Trade**: a chart-free stock page with live quote, day range, your position, a watchlist star and the order ticket (market and limit, delivery and intraday, stop-loss, target, trailing stop, live risk preview).
- **Portfolio**: Holdings, Positions, Orders, Funds and Analysis tabs, laid out like a broker app. Two money pots (Trading and Bank) with add, move and withdraw; returns are measured against the money you put into trading, so deposits never look like profit.
- **Analysis**: win rate with a 95% confidence interval, expectancy in R, stop usage, winners given back, MAE/MFE, tags and notes per trade, and plain-language findings about your own behaviour.
- **Backtester** (`lib/engine`): visual rule builder plus six swing presets. Signals are read at the close and filled at the next open, with pessimistic stop/target ordering, gap handling, trailing and time stops, slippage and Indian transaction charges. Reports win probability, Monte Carlo, in/out-of-sample and a stop-loss study that holds the target fixed so only the stop changes.
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

## Scripts

`npm run dev` · `npm run build` · `npm test` · `npm run typecheck` · `npm run lint`

## Limits to keep in mind

- All free market data here is unofficial (Upstox open endpoints, Yahoo, Moneycontrol, a Google Finance page). Any of them can throttle, delay, change or block without notice, and scraping may be against a site's terms; keep usage personal and low-volume. Upload a CSV on the Backtest page if every feed is down.
- Resting orders only run while the app is open. When you open it again, anything that triggered meanwhile is replayed from intraday candles (and logged). There is no always-on server watching prices.
- Broker logins: nothing here uses your broker account. Upstox's candle endpoints need no login. A real broker sandbox or API token would only be needed for live tick streaming or placing real orders.
- Free intraday history is short (about 59 days for 5m/15m, 7 days for 1m), so swing backtests use daily candles.
- No free historical option data exists, so F&O is not backtested.
- Backtests ignore survivorship bias (today's index members only), liquidity and circuit limits. A small number of trades is statistical noise; the app warns below 30.
- Short selling on NSE cash equity is intraday-only; the schema rejects delivery shorts.
- This is a learning and research tool, not financial advice.

## Layout

```
app/(app)/            explore, trade, backtest workbench, portfolio
app/api/              candles, quotes, symbols route handlers (proxy to data providers)
components/backtest/  rule builder, risk form, charts, result panels
components/paper/     provider, order ticket, positions, journal, portfolio view
lib/engine/           indicators, rules, walkTrade, simulator, costs, metrics, Monte Carlo, stop-loss study
lib/paper/            broker, store, analytics
lib/data/             Yahoo adapter, retry, cache, CSV import
supabase/migrations/  SQL to run in the Supabase editor
```
