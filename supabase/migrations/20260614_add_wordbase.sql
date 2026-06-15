-- AI-generated vocabulary archive (same shape as public.words).
-- Run in the Supabase SQL editor if the project already exists.

create table if not exists public.wordbase (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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

create index if not exists wordbase_user_id_idx on public.wordbase(user_id);
create unique index if not exists wordbase_user_term_unique_idx
  on public.wordbase(user_id, lower(term));

create trigger wordbase_set_updated_at
before update on public.wordbase
for each row
execute function public.set_updated_at();

alter table public.wordbase enable row level security;

create policy "Users can view their own wordbase rows"
on public.wordbase for select
using (user_id = auth.uid());

create policy "Users can insert their own wordbase rows"
on public.wordbase for insert
with check (user_id = auth.uid());

create policy "Users can update their own wordbase rows"
on public.wordbase for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their own wordbase rows"
on public.wordbase for delete
using (user_id = auth.uid());
