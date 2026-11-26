-- Phase 1: watchlists + candle cache. Run in Supabase Dashboard > SQL Editor.

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  symbol text not null,            -- Yahoo style, e.g. RELIANCE.NS, ^NSEI
  name text,
  created_at timestamptz not null default now(),
  unique (watchlist_id, symbol)
);

-- Shared candle cache (market data is not user specific).
create table if not exists public.candles (
  symbol text not null,
  interval text not null,          -- 1d, 15m, 5m, 1m
  ts timestamptz not null,
  open double precision not null,
  high double precision not null,
  low double precision not null,
  close double precision not null,
  volume double precision not null default 0,
  primary key (symbol, interval, ts)
);

alter table public.watchlists enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.candles enable row level security;

create policy "own watchlists" on public.watchlists
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own watchlist items" on public.watchlist_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "read candles" on public.candles
  for select to authenticated using (true);
create policy "insert candles" on public.candles
  for insert to authenticated with check (true);
create policy "update candles" on public.candles
  for update to authenticated using (true) with check (true);
