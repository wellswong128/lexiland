-- LexiLoop Supabase schema
-- Run this in the Supabase SQL editor after creating a Supabase project.

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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term text not null,
  definition text not null,
  translation text not null default '',
  pronunciation text not null default '',
  part_of_speech text not null default '',
  example text not null default '',
  notes text not null default '',
  tags text[] not null default '{}',
  source text not null default 'manual',
  review_level integer not null default 0,
  next_review_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  last_result text,
  is_mistake boolean not null default false,
  last_mistake_at timestamptz,
  mistake_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint words_source_check check (source in ('manual', 'import', 'ai')),
  constraint words_last_result_check check (
    last_result is null
    or last_result in ('correct', 'incorrect', 'remembered', 'forgot')
  ),
  constraint words_review_level_check check (review_level >= 0),
  constraint words_counts_check check (
    correct_count >= 0
    and incorrect_count >= 0
    and mistake_count >= 0
  )
);

create index if not exists words_user_id_idx on public.words(user_id);
create index if not exists words_user_next_review_idx
  on public.words(user_id, next_review_at);
create index if not exists words_user_is_mistake_idx
  on public.words(user_id, is_mistake);
create unique index if not exists words_user_term_unique_idx
  on public.words(user_id, lower(term));

create trigger words_set_updated_at
before update on public.words
for each row
execute function public.set_updated_at();

create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.words(id) on delete cascade,
  result text not null,
  review_mode text not null,
  created_at timestamptz not null default now(),
  constraint review_events_result_check check (
    result in ('correct', 'incorrect', 'remembered', 'forgot')
  ),
  constraint review_events_mode_check check (
    review_mode in ('flashcard', 'quiz')
  )
);

create index if not exists review_events_user_id_idx
  on public.review_events(user_id);
create index if not exists review_events_word_id_idx
  on public.review_events(word_id);

alter table public.profiles enable row level security;
alter table public.words enable row level security;
alter table public.review_events enable row level security;

create policy "Users can view their own profile"
on public.profiles for select
using (id = auth.uid());

create policy "Users can update their own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users can view their own words"
on public.words for select
using (user_id = auth.uid());

create policy "Users can insert their own words"
on public.words for insert
with check (user_id = auth.uid());

create policy "Users can update their own words"
on public.words for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their own words"
on public.words for delete
using (user_id = auth.uid());

create policy "Users can view their own review events"
on public.review_events for select
using (user_id = auth.uid());

create policy "Users can insert their own review events"
on public.review_events for insert
with check (user_id = auth.uid());
