-- Intraday margin pot (paper). Run in Supabase Dashboard > SQL Editor AFTER 0001 to 0003.
-- One row per user holding the whole intraday account as JSON, so it survives clearing the browser.

create table if not exists public.intraday_accounts (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  saved_at bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.intraday_accounts enable row level security;

create policy "own intraday account" on public.intraday_accounts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
