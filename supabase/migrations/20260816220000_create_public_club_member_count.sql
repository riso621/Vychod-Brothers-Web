create or replace function public.get_active_club_member_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::bigint
  from public.profiles as profile
  where profile.membership in ('member', 'vip')
    and profile.membership_status = 'active'
    and (
      profile.membership_expires_at is null
      or profile.membership_expires_at > now()
    );
$$;

revoke all on function public.get_active_club_member_count() from public;
grant execute on function public.get_active_club_member_count() to anon, authenticated, service_role;

comment on function public.get_active_club_member_count() is
  'Returns only the aggregate number of profiles with an active Club entitlement.';
