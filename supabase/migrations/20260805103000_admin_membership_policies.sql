drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

drop policy if exists "Admins can update memberships" on public.profiles;
create policy "Admins can update memberships"
  on public.profiles for update to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

grant update (membership, membership_started_at, membership_expires_at, membership_status)
  on table public.profiles to authenticated;

create or replace function public.protect_profile_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    new.membership is distinct from old.membership
    or new.membership_started_at is distinct from old.membership_started_at
    or new.membership_expires_at is distinct from old.membership_expires_at
    or new.membership_status is distinct from old.membership_status
  ) and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin'
    and current_user not in ('postgres', 'service_role')
  then
    raise exception 'membership fields are admin-managed' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_profile_membership() from public, anon, authenticated;

drop trigger if exists protect_profile_membership_fields on public.profiles;
create trigger protect_profile_membership_fields
  before update on public.profiles
  for each row execute function public.protect_profile_membership();
