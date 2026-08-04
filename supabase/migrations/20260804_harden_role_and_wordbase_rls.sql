-- Harden role checks and shared WordBase writes.

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select case
    when lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'student'))
      in ('owner', 'admin', 'teacher', 'student', 'parent')
    then lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'student'))
    else 'student'
  end;
$$;

drop policy if exists "Authenticated users can update wordbase rows" on public.wordbase;

create policy "Authenticated users can update wordbase rows"
on public.wordbase for update
using (
  auth.uid() is not null
  and (
    contributor_id = auth.uid()
    or public.current_app_role() in ('owner', 'admin')
  )
)
with check (
  auth.uid() is not null
  and (
    contributor_id = auth.uid()
    or public.current_app_role() in ('owner', 'admin')
  )
);
