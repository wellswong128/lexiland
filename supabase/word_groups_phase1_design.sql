-- Phase 1 Word Groups: schema + RLS/RBAC design (Step 2)
-- Status: design-reviewed draft (do not apply directly in this step)
--
-- Notes:
-- - This file is intentionally outside supabase/migrations/ for Step 2 design review.
-- - Step 3 will convert this reviewed draft into a migration file.

create extension if not exists "pgcrypto";

-- Reuse project trigger helper (already defined in schema.sql).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Read role from JWT claims (aligned with frontend/backend role model).
create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select lower(
    coalesce(
      auth.jwt() -> 'app_metadata' ->> 'role',
      'student'
    )
  );
$$;

create or replace function public.is_owner_or_admin()
returns boolean
language sql
stable
as $$
  select public.current_app_role() in ('owner', 'admin');
$$;

create or replace function public.is_hk_subject_allowed_for_grade(
  target_grade text,
  target_subject text
)
returns boolean
language sql
immutable
as $$
  select case upper(coalesce(target_grade, ''))
    when 'P1' then lower(coalesce(target_subject, '')) in ('english', 'mathematics', 'general-studies')
    when 'P2' then lower(coalesce(target_subject, '')) in ('english', 'mathematics', 'general-studies')
    when 'P3' then lower(coalesce(target_subject, '')) in ('english', 'mathematics', 'general-studies')
    when 'P4' then lower(coalesce(target_subject, '')) in ('english', 'mathematics', 'general-studies', 'science')
    when 'P5' then lower(coalesce(target_subject, '')) in ('english', 'mathematics', 'general-studies', 'science')
    when 'P6' then lower(coalesce(target_subject, '')) in ('english', 'mathematics', 'general-studies', 'science')
    when 'S1' then lower(coalesce(target_subject, '')) in ('english', 'mathematics', 'integrated-science', 'chinese-history', 'history', 'geography')
    when 'S2' then lower(coalesce(target_subject, '')) in ('english', 'mathematics', 'integrated-science', 'chinese-history', 'history', 'geography')
    when 'S3' then lower(coalesce(target_subject, '')) in ('english', 'mathematics', 'integrated-science', 'chinese-history', 'history', 'geography')
    when 'S4' then lower(coalesce(target_subject, '')) in ('english', 'mathematics', 'physics', 'chemistry', 'biology', 'economics', 'geography', 'history', 'ict')
    when 'S5' then lower(coalesce(target_subject, '')) in ('english', 'mathematics', 'physics', 'chemistry', 'biology', 'economics', 'geography', 'history', 'ict')
    when 'S6' then lower(coalesce(target_subject, '')) in ('english', 'mathematics', 'physics', 'chemistry', 'biology', 'economics', 'geography', 'history', 'ict')
    else false
  end;
$$;

create table if not exists public.word_groups (
  id uuid primary key default gen_random_uuid(),
  group_code text not null,
  level text not null,
  grade text not null,
  subject text not null,
  display_name_en text not null,
  display_name_zh_hant text not null default '',
  locale text not null default 'zh-Hant',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint word_groups_group_code_unique unique (group_code),
  constraint word_groups_level_check check (lower(level) in ('primary', 'secondary')),
  constraint word_groups_grade_check check (upper(grade) in ('P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6')),
  constraint word_groups_grade_subject_check check (
    public.is_hk_subject_allowed_for_grade(upper(grade), lower(subject))
  ),
  constraint word_groups_group_code_check check (
    group_code = format('hk-%s-%s-%s', lower(level), lower(grade), lower(subject))
  )
);

create unique index if not exists word_groups_level_grade_subject_unique_idx
  on public.word_groups(lower(level), upper(grade), lower(subject));
create index if not exists word_groups_grade_idx
  on public.word_groups(upper(grade));
create index if not exists word_groups_active_grade_idx
  on public.word_groups(is_active, upper(grade), lower(subject));

create trigger word_groups_set_updated_at
before update on public.word_groups
for each row
execute function public.set_updated_at();

create table if not exists public.wordbase_group_map (
  id uuid primary key default gen_random_uuid(),
  wordbase_id uuid not null references public.wordbase(id) on delete cascade,
  group_id uuid not null references public.word_groups(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint wordbase_group_map_unique unique (wordbase_id, group_id)
);

create index if not exists wordbase_group_map_group_id_idx
  on public.wordbase_group_map(group_id);
create index if not exists wordbase_group_map_wordbase_id_idx
  on public.wordbase_group_map(wordbase_id);

create table if not exists public.user_group_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.word_groups(id) on delete cascade,
  picked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint user_group_picks_unique unique (user_id, group_id)
);

create index if not exists user_group_picks_user_id_idx
  on public.user_group_picks(user_id, picked_at desc);
create index if not exists user_group_picks_group_id_idx
  on public.user_group_picks(group_id);

create table if not exists public.user_group_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_group_id uuid not null references public.word_groups(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_group_preferences_active_group_idx
  on public.user_group_preferences(active_group_id);

create trigger user_group_preferences_set_updated_at
before update on public.user_group_preferences
for each row
execute function public.set_updated_at();

create or replace function public.validate_active_group_is_picked()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.user_group_picks p
    where p.user_id = new.user_id
      and p.group_id = new.active_group_id
  ) then
    raise exception 'active_group_id must belong to user_group_picks for this user'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists user_group_preferences_validate_pick on public.user_group_preferences;
create trigger user_group_preferences_validate_pick
before insert or update on public.user_group_preferences
for each row
execute function public.validate_active_group_is_picked();

-- ---------------------------
-- RLS and RBAC policies
-- ---------------------------
alter table public.word_groups enable row level security;
alter table public.wordbase_group_map enable row level security;
alter table public.user_group_picks enable row level security;
alter table public.user_group_preferences enable row level security;

-- word_groups: read by any authenticated user; write by owner/admin.
create policy "Authenticated users can read word_groups"
on public.word_groups for select
using (auth.uid() is not null);

create policy "Owner/admin can insert word_groups"
on public.word_groups for insert
with check (auth.uid() is not null and public.is_owner_or_admin());

create policy "Owner/admin can update word_groups"
on public.word_groups for update
using (auth.uid() is not null and public.is_owner_or_admin())
with check (auth.uid() is not null and public.is_owner_or_admin());

create policy "Owner/admin can delete word_groups"
on public.word_groups for delete
using (auth.uid() is not null and public.is_owner_or_admin());

-- wordbase_group_map: read by any authenticated user; write by owner/admin.
create policy "Authenticated users can read wordbase_group_map"
on public.wordbase_group_map for select
using (auth.uid() is not null);

create policy "Owner/admin can insert wordbase_group_map"
on public.wordbase_group_map for insert
with check (auth.uid() is not null and public.is_owner_or_admin());

create policy "Owner/admin can update wordbase_group_map"
on public.wordbase_group_map for update
using (auth.uid() is not null and public.is_owner_or_admin())
with check (auth.uid() is not null and public.is_owner_or_admin());

create policy "Owner/admin can delete wordbase_group_map"
on public.wordbase_group_map for delete
using (auth.uid() is not null and public.is_owner_or_admin());

-- user_group_picks: user manages own rows; owner/admin can manage all rows.
create policy "Users can read own picks, owner/admin can read all"
on public.user_group_picks for select
using (
  auth.uid() is not null
  and (user_id = auth.uid() or public.is_owner_or_admin())
);

create policy "Users can insert own picks, owner/admin can insert all"
on public.user_group_picks for insert
with check (
  auth.uid() is not null
  and (user_id = auth.uid() or public.is_owner_or_admin())
);

create policy "Users can delete own picks, owner/admin can delete all"
on public.user_group_picks for delete
using (
  auth.uid() is not null
  and (user_id = auth.uid() or public.is_owner_or_admin())
);

-- user_group_preferences: user manages own row; owner/admin can manage all.
create policy "Users can read own preferences, owner/admin can read all"
on public.user_group_preferences for select
using (
  auth.uid() is not null
  and (user_id = auth.uid() or public.is_owner_or_admin())
);

create policy "Users can insert own preferences, owner/admin can insert all"
on public.user_group_preferences for insert
with check (
  auth.uid() is not null
  and (user_id = auth.uid() or public.is_owner_or_admin())
);

create policy "Users can update own preferences, owner/admin can update all"
on public.user_group_preferences for update
using (
  auth.uid() is not null
  and (user_id = auth.uid() or public.is_owner_or_admin())
)
with check (
  auth.uid() is not null
  and (user_id = auth.uid() or public.is_owner_or_admin())
);

create policy "Users can delete own preferences, owner/admin can delete all"
on public.user_group_preferences for delete
using (
  auth.uid() is not null
  and (user_id = auth.uid() or public.is_owner_or_admin())
);
