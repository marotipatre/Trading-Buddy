# Trading Buddy

Paper trading and strategy backtesting for the Indian stock market (NSE), built with Next.js 16, Supabase and shadcn/ui.

It answers two questions honestly:

1. **What is my probability of winning?** Win rate with a 95% Wilson confidence interval, expectancy, profit factor, a Monte Carlo of your trades (chance of profit, chance of a 50% drawdown), and an in-sample vs out-of-sample split to expose overfitting.
2. **Is my stop-loss really helping?** The same entries are replayed with no stop, your stop and a grid of stops. You get total P&L, drawdown and worst trade for each, how many stopped trades would have recovered, how much loss the stop saved versus profit it gave up, and a max-adverse-excursion chart.

## Features

- **Backtester** (`lib/engine`): visual rule builder plus six swing presets (EMA cross, RSI pullback, 20-day breakout, Bollinger reversion, MACD + trend, Supertrend). Signals are read at the close and filled at the next open, with pessimistic stop/target ordering, gap handling, trailing stops, time stops, slippage and Indian transaction charges (STT, stamp duty, exchange, SEBI, GST, DP).
- **Paper trading** (`lib/paper`): market and limit orders, delivery and intraday, bracket stops/targets, trailing stops, intraday square-off at 15:15 IST, and catch-up of stops/targets that triggered while the app was closed. Uses the same cost model as the backtester.
- **Data** (`lib/data`): free, unofficial Yahoo Finance feed with retry/backoff, a Supabase candle cache, stale-cache fallback and CSV import.
- **Trade journal and analytics** on your paper trades, using the same metrics code as backtests.

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

- All free market data here is unofficial. Yahoo can throttle (HTTP 429), delay or change without notice. Upload a CSV on the Backtest page if a feed is down.
- Free intraday history is short (about 59 days for 5m/15m, 7 days for 1m), so swing backtests use daily candles.
- No free historical option data exists, so F&O is not backtested.
- Backtests ignore survivorship bias (today's index members only), liquidity and circuit limits. A small number of trades is statistical noise; the app warns below 30.
- Short selling on NSE cash equity is intraday-only; the schema rejects delivery shorts.
- This is a learning and research tool, not financial advice.

## Layout

```
app/(app)/            dashboard, trade (live quote + order ticket), backtest workbench, portfolio
app/api/              candles, quotes, symbols route handlers (proxy to data providers)
components/backtest/  rule builder, risk form, charts, result panels
components/paper/     provider, order ticket, positions, journal, portfolio view
lib/engine/           indicators, rules, walkTrade, simulator, costs, metrics, Monte Carlo, stop-loss study
lib/paper/            broker, store, analytics
lib/data/             Yahoo adapter, retry, cache, CSV import
supabase/migrations/  SQL to run in the Supabase editor
```
