-- Price alerts. Run in Supabase Dashboard > SQL Editor AFTER 0001 and 0002.

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  symbol text not null,                                   -- RELIANCE.NS, ^NSEI, ...
  direction text not null check (direction in ('above', 'below')),
  price double precision not null check (price > 0),
  note text,
  status text not null default 'active' check (status in ('active', 'triggered', 'cancelled')),
  created_at timestamptz not null default now(),
  triggered_at timestamptz,
  triggered_price double precision
);

create index if not exists price_alerts_user_status on public.price_alerts (user_id, status);

alter table public.price_alerts enable row level security;

create policy "own price alerts" on public.price_alerts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
