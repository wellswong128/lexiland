-- Harden role and WordBase maintenance access after shared dictionary rollout.

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'student'));
$$;

create or replace function public.is_owner_or_admin()
returns boolean
language sql
stable
as $$
  select public.current_app_role() in ('owner', 'admin');
$$;

drop policy if exists "Authenticated users can update wordbase rows" on public.wordbase;
drop policy if exists "Contributors and admins can update wordbase rows" on public.wordbase;

create policy "Contributors and admins can update wordbase rows"
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

revoke execute on function public.get_incomplete_wordbase_rows(integer, text) from authenticated;
grant execute on function public.get_incomplete_wordbase_rows(integer, text) to service_role;
