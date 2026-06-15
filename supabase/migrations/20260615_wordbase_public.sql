-- Convert wordbase from per-user storage to a shared public dictionary.

alter table public.wordbase add column if not exists term_key text;

update public.wordbase
set term_key = lower(trim(term))
where term_key is null;

alter table public.wordbase alter column term_key set not null;

with ranked_rows as (
  select
    id,
    row_number() over (
      partition by term_key
      order by updated_at desc, created_at desc
    ) as row_rank
  from public.wordbase
)
delete from public.wordbase
where id in (
  select id
  from ranked_rows
  where row_rank > 1
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wordbase'
      and column_name = 'user_id'
  ) then
    alter table public.wordbase rename column user_id to contributor_id;
  end if;
end $$;

drop index if exists public.wordbase_user_id_idx;
drop index if exists public.wordbase_user_term_unique_idx;

create index if not exists wordbase_contributor_id_idx on public.wordbase(contributor_id);
create unique index if not exists wordbase_term_key_unique_idx on public.wordbase(term_key);

drop policy if exists "Users can view their own wordbase rows" on public.wordbase;
drop policy if exists "Users can insert their own wordbase rows" on public.wordbase;
drop policy if exists "Users can update their own wordbase rows" on public.wordbase;
drop policy if exists "Users can delete their own wordbase rows" on public.wordbase;

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
