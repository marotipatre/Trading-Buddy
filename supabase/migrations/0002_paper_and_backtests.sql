-- Phase 3: paper trading account state + saved backtests.
-- Run in Supabase Dashboard > SQL Editor AFTER 0001_init.sql.

create table if not exists public.paper_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  state jsonb not null,               -- full PaperState (cash, positions, orders, trades, costs)
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_backtests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  symbol text not null,
  years int not null,
  strategy jsonb not null,            -- StrategyDef
  summary jsonb not null,             -- headline metrics for the list view
  created_at timestamptz not null default now()
);

create index if not exists saved_backtests_user_created
  on public.saved_backtests (user_id, created_at desc);

alter table public.paper_accounts enable row level security;
alter table public.saved_backtests enable row level security;

create policy "own paper account" on public.paper_accounts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own saved backtests" on public.saved_backtests
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
