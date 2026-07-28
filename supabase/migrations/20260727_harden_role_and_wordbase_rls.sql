-- Harden role-derived policies against client-writable user metadata and
-- prevent arbitrary authenticated users from updating shared WordBase rows.

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

drop policy if exists "Authenticated users can update wordbase rows" on public.wordbase;

create policy "Authenticated users can update wordbase rows"
on public.wordbase for update
using (
  auth.uid() is not null
  and (
    contributor_id = auth.uid()
    or public.is_owner_or_admin()
  )
)
with check (
  auth.uid() is not null
  and (
    contributor_id = auth.uid()
    or public.is_owner_or_admin()
  )
);
