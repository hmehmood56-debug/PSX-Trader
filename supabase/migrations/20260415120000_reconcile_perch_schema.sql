-- Perch: reconcile public schema with app/actions/portfolio.ts
-- Idempotent: safe to run multiple times. Does not drop columns.

begin;

-- ---------------------------------------------------------------------------
-- public.portfolio_snapshots
-- Code: .from("portfolio_snapshots").select("cash, holdings, transactions, account_activity").eq("user_id", ...)
--       upsert: user_id, cash, holdings, transactions, account_activity, updated_at
-- ---------------------------------------------------------------------------
create table if not exists public.portfolio_snapshots (
  user_id uuid not null primary key references auth.users (id) on delete cascade,
  cash double precision not null default 1000000,
  holdings jsonb not null default '[]'::jsonb,
  transactions jsonb not null default '[]'::jsonb,
  account_activity jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.portfolio_snapshots
  add column if not exists cash double precision;
alter table public.portfolio_snapshots
  add column if not exists holdings jsonb;
alter table public.portfolio_snapshots
  add column if not exists transactions jsonb;
alter table public.portfolio_snapshots
  add column if not exists account_activity jsonb;
alter table public.portfolio_snapshots
  add column if not exists updated_at timestamptz;

-- Defaults for rows created before columns existed (defensive)
alter table public.portfolio_snapshots
  alter column cash set default 1000000;
update public.portfolio_snapshots set cash = 1000000 where cash is null;
alter table public.portfolio_snapshots
  alter column cash set not null;

update public.portfolio_snapshots set holdings = '[]'::jsonb where holdings is null;
alter table public.portfolio_snapshots
  alter column holdings set default '[]'::jsonb;
alter table public.portfolio_snapshots
  alter column holdings set not null;

update public.portfolio_snapshots set transactions = '[]'::jsonb where transactions is null;
alter table public.portfolio_snapshots
  alter column transactions set default '[]'::jsonb;
alter table public.portfolio_snapshots
  alter column transactions set not null;

update public.portfolio_snapshots set account_activity = '[]'::jsonb where account_activity is null;
alter table public.portfolio_snapshots
  alter column account_activity set default '[]'::jsonb;
alter table public.portfolio_snapshots
  alter column account_activity set not null;

update public.portfolio_snapshots set updated_at = now() where updated_at is null;
alter table public.portfolio_snapshots
  alter column updated_at set default now();
alter table public.portfolio_snapshots
  alter column updated_at set not null;

-- ---------------------------------------------------------------------------
-- public.profiles
-- Code: .from("profiles").select("username, onboarding_completed").eq("id", user.id)
--       upsert: id, username, onboarding_completed
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid not null primary key references auth.users (id) on delete cascade,
  username text not null,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint profiles_username_unique unique (username)
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists onboarding_completed boolean;
alter table public.profiles add column if not exists created_at timestamptz;

update public.profiles set onboarding_completed = false where onboarding_completed is null;
alter table public.profiles
  alter column onboarding_completed set default false;
alter table public.profiles
  alter column onboarding_completed set not null;

update public.profiles set created_at = now() where created_at is null;
alter table public.profiles
  alter column created_at set default now();
alter table public.profiles
  alter column created_at set not null;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
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
  using (auth.uid() = id)
  with check (auth.uid() = id);

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
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Grants for PostgREST (authenticated JWT)
-- ---------------------------------------------------------------------------
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.portfolio_snapshots to authenticated;

commit;
