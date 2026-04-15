-- Run this in the Supabase SQL editor (or via CLI) before using cloud persistence.
-- Requires: Auth "Confirm email" disabled for smooth synthetic-email signup, OR real email flow.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.portfolio_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  cash double precision not null,
  holdings jsonb not null default '[]'::jsonb,
  transactions jsonb not null default '[]'::jsonb,
  account_activity jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists profiles_username_lower on public.profiles (lower(username));

alter table public.profiles enable row level security;
alter table public.portfolio_snapshots enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "portfolio_select_own" on public.portfolio_snapshots;
create policy "portfolio_select_own"
  on public.portfolio_snapshots for select
  using (auth.uid() = user_id);

drop policy if exists "portfolio_insert_own" on public.portfolio_snapshots;
create policy "portfolio_insert_own"
  on public.portfolio_snapshots for insert
  with check (auth.uid() = user_id);

drop policy if exists "portfolio_update_own" on public.portfolio_snapshots;
create policy "portfolio_update_own"
  on public.portfolio_snapshots for update
  using (auth.uid() = user_id);
