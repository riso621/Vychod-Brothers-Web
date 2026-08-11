insert into public.analytics_daily_visitors(day, visitor_hash, created_at)
select
  (created_at at time zone 'Europe/Bratislava')::date,
  visitor_hash,
  min(created_at)
from public.analytics_events
group by (created_at at time zone 'Europe/Bratislava')::date, visitor_hash
on conflict (day, visitor_hash) do nothing;

insert into public.analytics_daily_counts(day, unique_visitors, updated_at)
select day, count(*)::integer, now()
from public.analytics_daily_visitors
group by day
on conflict (day) do update
set unique_visitors = excluded.unique_visitors,
    updated_at = now();
