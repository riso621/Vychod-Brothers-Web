create or replace function public.get_homepage_counts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'member_count', public.get_active_club_member_count(),
    'video_count', (
      select count(*)::bigint
      from public.videos as video
      where video.published = true
    )
  );
$$;

revoke all on function public.get_homepage_counts() from public;
grant execute on function public.get_homepage_counts() to anon, authenticated, service_role;

comment on function public.get_homepage_counts() is
  'Returns only public homepage aggregates: active Club members and published catalog videos.';
