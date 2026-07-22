-- Trust only service-controlled app_metadata roles and restrict shared WordBase edits.

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
