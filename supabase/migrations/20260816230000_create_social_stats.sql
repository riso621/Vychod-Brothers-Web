create table if not exists public.social_stats (
  platform text primary key,
  followers bigint,
  synced_at timestamptz,
  status text not null default 'pending',
  last_error text,
  updated_at timestamptz not null default now(),
  constraint social_stats_platform_check check (platform in ('youtube', 'instagram', 'tiktok')),
  constraint social_stats_followers_check check (followers is null or followers >= 0),
  constraint social_stats_status_check check (status in ('pending', 'ok', 'error'))
);

alter table public.social_stats enable row level security;
revoke all on table public.social_stats from anon, authenticated;

insert into public.social_stats (platform)
values ('youtube'), ('instagram'), ('tiktok')
on conflict (platform) do nothing;

create or replace function public.get_public_social_stats()
returns table(platform text, followers bigint, synced_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select stats.platform, stats.followers, stats.synced_at
  from public.social_stats as stats
  where stats.followers is not null
  order by stats.platform;
$$;

revoke all on function public.get_public_social_stats() from public;
grant execute on function public.get_public_social_stats() to anon, authenticated;

comment on table public.social_stats is
  'Server-managed last successful aggregate follower/subscriber counts. Credentials and raw provider responses are never stored here.';
comment on function public.get_public_social_stats() is
  'Returns only public aggregate counts and their last successful sync timestamps.';
