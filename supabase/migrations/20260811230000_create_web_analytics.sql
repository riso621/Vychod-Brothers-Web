create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  visitor_hash text not null check (char_length(visitor_hash) = 64),
  session_hash text not null check (char_length(session_hash) = 64),
  path text not null check (char_length(path) between 1 and 300),
  source text not null default 'Direct' check (char_length(source) between 1 and 80),
  device text not null check (device in ('Mobile','Desktop','Tablet')),
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_presence (
  visitor_hash text primary key check (char_length(visitor_hash) = 64),
  path text not null check (char_length(path) between 1 and 300),
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_idx on public.analytics_events(created_at desc);
create index if not exists analytics_events_path_created_idx on public.analytics_events(path, created_at desc);
create index if not exists analytics_events_visitor_created_idx on public.analytics_events(visitor_hash, created_at desc);
create index if not exists analytics_events_session_created_idx on public.analytics_events(session_hash, created_at desc);
create index if not exists analytics_presence_seen_idx on public.analytics_presence(last_seen desc);

alter table public.analytics_events enable row level security;
alter table public.analytics_presence enable row level security;
revoke all on public.analytics_events from anon, authenticated;
revoke all on public.analytics_presence from anon, authenticated;
grant all on public.analytics_events to service_role;
grant all on public.analytics_presence to service_role;

create or replace function public.analytics_admin_snapshot(p_range text default '7d')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_today timestamptz := date_trunc('day', now() at time zone 'Europe/Bratislava') at time zone 'Europe/Bratislava';
  v_tomorrow timestamptz := (date_trunc('day', now() at time zone 'Europe/Bratislava') + interval '1 day') at time zone 'Europe/Bratislava';
  v_week timestamptz := date_trunc('week', now() at time zone 'Europe/Bratislava') at time zone 'Europe/Bratislava';
  v_month timestamptz := date_trunc('month', now() at time zone 'Europe/Bratislava') at time zone 'Europe/Bratislava';
  v_start timestamptz;
  v_step interval;
  v_bucket text;
  v_result jsonb;
begin
  if p_range = '24h' then v_start := date_trunc('hour', v_now) - interval '23 hours'; v_step := interval '1 hour'; v_bucket := 'hour';
  elsif p_range = '30d' then v_start := v_today - interval '29 days'; v_step := interval '1 day'; v_bucket := 'day';
  elsif p_range = '90d' then v_start := v_today - interval '89 days'; v_step := interval '1 day'; v_bucket := 'day';
  elsif p_range = '12m' then v_start := v_month - interval '11 months'; v_step := interval '1 month'; v_bucket := 'month';
  else v_start := v_today - interval '6 days'; v_step := interval '1 day'; v_bucket := 'day'; p_range := '7d';
  end if;

  select jsonb_build_object(
    'range', p_range,
    'trackingSince', (select min(created_at) from analytics_events),
    'online', (select count(*) from analytics_presence where last_seen >= v_now - interval '90 seconds'),
    'onlinePages', coalesce((select jsonb_agg(row_to_json(x) order by x.visitors desc) from (select path, count(*) visitors from analytics_presence where last_seen >= v_now - interval '90 seconds' group by path) x), '[]'::jsonb),
    'summary', jsonb_build_object(
      'today', jsonb_build_object('visitors',(select count(distinct session_hash) from analytics_events where created_at>=v_today and created_at<v_tomorrow),'uniques',(select count(distinct visitor_hash) from analytics_events where created_at>=v_today and created_at<v_tomorrow),'pageviews',(select count(*) from analytics_events where created_at>=v_today and created_at<v_tomorrow)),
      'yesterday', jsonb_build_object('visitors',(select count(distinct session_hash) from analytics_events where created_at>=v_today-interval '1 day' and created_at<v_today),'uniques',(select count(distinct visitor_hash) from analytics_events where created_at>=v_today-interval '1 day' and created_at<v_today),'pageviews',(select count(*) from analytics_events where created_at>=v_today-interval '1 day' and created_at<v_today)),
      'week', jsonb_build_object('visitors',(select count(distinct session_hash) from analytics_events where created_at>=v_week),'uniques',(select count(distinct visitor_hash) from analytics_events where created_at>=v_week),'pageviews',(select count(*) from analytics_events where created_at>=v_week)),
      'previousWeek', jsonb_build_object('visitors',(select count(distinct session_hash) from analytics_events where created_at>=v_week-interval '7 days' and created_at<v_week),'uniques',(select count(distinct visitor_hash) from analytics_events where created_at>=v_week-interval '7 days' and created_at<v_week),'pageviews',(select count(*) from analytics_events where created_at>=v_week-interval '7 days' and created_at<v_week)),
      'month', jsonb_build_object('visitors',(select count(distinct session_hash) from analytics_events where created_at>=v_month),'uniques',(select count(distinct visitor_hash) from analytics_events where created_at>=v_month),'pageviews',(select count(*) from analytics_events where created_at>=v_month)),
      'previousMonth', jsonb_build_object('visitors',(select count(distinct session_hash) from analytics_events where created_at>=v_month-interval '1 month' and created_at<v_month),'uniques',(select count(distinct visitor_hash) from analytics_events where created_at>=v_month-interval '1 month' and created_at<v_month),'pageviews',(select count(*) from analytics_events where created_at>=v_month-interval '1 month' and created_at<v_month))
    ),
    'chart', coalesce((select jsonb_agg(row_to_json(c) order by c.bucket) from (select b bucket, count(distinct e.visitor_hash) uniques, count(e.id) pageviews from generate_series(v_start, date_trunc(v_bucket,v_now), v_step) b left join analytics_events e on e.created_at>=b and e.created_at<b+v_step group by b) c), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(row_to_json(p) order by p.pageviews desc) from (select path,count(*) pageviews from analytics_events where created_at>=v_start group by path order by pageviews desc limit 10) p), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(row_to_json(s) order by s.visits desc) from (select source,count(distinct session_hash) visits from analytics_events where created_at>=v_start group by source order by visits desc) s), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(row_to_json(d) order by d.visits desc) from (select device,count(distinct visitor_hash) visits from analytics_events where created_at>=v_start group by device order by visits desc) d), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.analytics_admin_snapshot(text) from public, anon, authenticated;
grant execute on function public.analytics_admin_snapshot(text) to service_role;
