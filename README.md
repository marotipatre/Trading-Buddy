# Trading Buddy (PaperDesk)

Paper trading and strategy backtesting for the Indian stock market (NSE), built with Next.js 16 and Supabase.

## Setup

1. Create a Supabase project and run `supabase/migrations/*.sql` in the SQL editor, in order.
2. Create `.env.local` (git-ignored, never commit it):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

3. `npm install && npm run dev`

## Scripts

`npm run dev` · `npm run build` · `npm test` · `npm run typecheck` · `npm run lint`

Market data comes from unofficial free sources (Yahoo Finance) and may be delayed or change without notice.
