-- Real trading waitlist: one row per authenticated user.

create table if not exists public.real_trading_waitlist (
  user_id uuid primary key references auth.users (id) on delete cascade,
  interest_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists real_trading_waitlist_created_at on public.real_trading_waitlist (created_at desc);

alter table public.real_trading_waitlist enable row level security;

drop policy if exists "real_trading_waitlist_select_own" on public.real_trading_waitlist;
create policy "real_trading_waitlist_select_own"
  on public.real_trading_waitlist for select
  using (auth.uid() = user_id);

drop policy if exists "real_trading_waitlist_insert_own" on public.real_trading_waitlist;
create policy "real_trading_waitlist_insert_own"
  on public.real_trading_waitlist for insert
  with check (auth.uid() = user_id);
