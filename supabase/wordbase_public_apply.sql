-- LexiLand: wordbase public shared dictionary
-- Safe to run in the Supabase SQL editor.
--
-- Handles all current states:
--   A) wordbase table does not exist  -> creates the final public schema
--   B) wordbase exists (per-user)     -> migrates user_id -> contributor_id, adds term_key
--   C) wordbase already migrated      -> no-op on structure; refreshes indexes/policies
--
-- Run once. Re-running is safe (uses IF NOT EXISTS / IF EXISTS guards).

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- A) Create wordbase if missing (final public-shared shape)
-- ---------------------------------------------------------------------------
create table if not exists public.wordbase (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references auth.users(id) on delete cascade,
  term_key text not null,
  term text not null,
  definition text not null,
  translation text not null default '',
  pronunciation text not null default '',
  part_of_speech text not null default '',
  example text not null default '',
  example_translation text not null default '',
  notes text not null default '',
  tags text[] not null default '{}',
  source text not null default 'ai',
  review_level integer not null default 0,
  next_review_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  last_result text,
  is_mistake boolean not null default false,
  last_mistake_at timestamptz,
  mistake_count integer not null default 0,
  memory_tips_by_locale jsonb not null default '{}'::jsonb,
  memory_image jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wordbase_source_check check (source in ('manual', 'import', 'ai')),
  constraint wordbase_last_result_check check (
    last_result is null
    or last_result in ('correct', 'incorrect', 'remembered', 'forgot')
  ),
  constraint wordbase_review_level_check check (review_level >= 0),
  constraint wordbase_counts_check check (
    correct_count >= 0
    and incorrect_count >= 0
    and mistake_count >= 0
  )
);

-- ---------------------------------------------------------------------------
-- B) Migrate legacy per-user wordbase (from 20260614_add_wordbase.sql)
-- ---------------------------------------------------------------------------

-- Legacy installs used user_id instead of contributor_id.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wordbase'
      and column_name = 'user_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wordbase'
      and column_name = 'contributor_id'
  ) then
    alter table public.wordbase rename column user_id to contributor_id;
  end if;
end $$;

-- Global lookup key (lowercase trimmed term).
alter table public.wordbase add column if not exists term_key text;

update public.wordbase
set term_key = lower(trim(term))
where term_key is null;

-- Remove duplicate terms before adding the global unique index.
-- Keeps the most recently updated row per term_key.
with ranked_rows as (
  select
    id,
    row_number() over (
      partition by term_key
      order by updated_at desc nulls last, created_at desc nulls last
    ) as row_rank
  from public.wordbase
  where term_key is not null
)
delete from public.wordbase
where id in (
  select id
  from ranked_rows
  where row_rank > 1
);

-- Only enforce NOT NULL when every row has a term_key.
do $$
begin
  if not exists (
    select 1
    from public.wordbase
    where term_key is null
  ) then
    alter table public.wordbase alter column term_key set not null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
drop index if exists public.wordbase_user_id_idx;
drop index if exists public.wordbase_user_term_unique_idx;

create index if not exists wordbase_contributor_id_idx
  on public.wordbase(contributor_id);

create unique index if not exists wordbase_term_key_unique_idx
  on public.wordbase(term_key);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
drop trigger if exists wordbase_set_updated_at on public.wordbase;

create trigger wordbase_set_updated_at
before update on public.wordbase
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security (public read for all authenticated users)
-- ---------------------------------------------------------------------------
alter table public.wordbase enable row level security;

drop policy if exists "Users can view their own wordbase rows" on public.wordbase;
drop policy if exists "Users can insert their own wordbase rows" on public.wordbase;
drop policy if exists "Users can update their own wordbase rows" on public.wordbase;
drop policy if exists "Users can delete their own wordbase rows" on public.wordbase;

drop policy if exists "Authenticated users can view wordbase" on public.wordbase;
drop policy if exists "Authenticated users can insert wordbase rows" on public.wordbase;
drop policy if exists "Authenticated users can update wordbase rows" on public.wordbase;

create policy "Authenticated users can view wordbase"
on public.wordbase for select
using (auth.uid() is not null);

create policy "Authenticated users can insert wordbase rows"
on public.wordbase for insert
with check (auth.uid() is not null and contributor_id = auth.uid());

create policy "Authenticated users can update wordbase rows"
on public.wordbase for update
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- Verification (optional — inspect results in the SQL editor output)
-- ---------------------------------------------------------------------------
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'wordbase'
order by ordinal_position;

select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'wordbase'
order by policyname;
