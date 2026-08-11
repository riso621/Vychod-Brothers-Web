create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (char_length(type) between 3 and 80),
  title text not null check (char_length(title) between 2 and 140),
  message text not null check (char_length(message) between 2 and 500),
  entity_type text check (entity_type is null or char_length(entity_type) <= 80),
  entity_id text check (entity_id is null or char_length(entity_id) <= 180),
  target_url text not null check (target_url like '/admin%'),
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique check (char_length(dedupe_key) between 4 and 240),
  read_at timestamptz,
  read_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_created_idx on public.admin_notifications(created_at desc);
create index if not exists admin_notifications_unread_created_idx on public.admin_notifications(created_at desc) where read_at is null;
create index if not exists admin_notifications_type_created_idx on public.admin_notifications(type, created_at desc);
alter table public.admin_notifications enable row level security;
revoke all on public.admin_notifications from anon, authenticated;
grant all on public.admin_notifications to service_role;
grant select on public.admin_notifications to authenticated;

drop policy if exists "Admins can receive notifications" on public.admin_notifications;
create policy "Admins can receive notifications" on public.admin_notifications for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='admin_notifications') then
    alter publication supabase_realtime add table public.admin_notifications;
  end if;
end $$;

create table if not exists public.analytics_daily_visitors (
  day date not null,
  visitor_hash text not null check (char_length(visitor_hash)=64),
  created_at timestamptz not null default now(),
  primary key(day, visitor_hash)
);
create table if not exists public.analytics_daily_counts (
  day date primary key,
  unique_visitors integer not null default 0 check (unique_visitors >= 0),
  updated_at timestamptz not null default now()
);
alter table public.analytics_daily_visitors enable row level security;
alter table public.analytics_daily_counts enable row level security;
revoke all on public.analytics_daily_visitors from public, anon, authenticated;
revoke all on public.analytics_daily_counts from public, anon, authenticated;
grant all on public.analytics_daily_visitors to service_role;
grant all on public.analytics_daily_counts to service_role;

create or replace function public.analytics_register_daily_visitor(p_visitor_hash text)
returns integer language plpgsql security definer set search_path='' as $$
declare
  v_day date := (now() at time zone 'Europe/Bratislava')::date;
  v_count integer;
  v_previous integer;
begin
  if char_length(p_visitor_hash) <> 64 then raise exception 'Invalid analytics visitor'; end if;
  insert into public.analytics_daily_visitors(day,visitor_hash) values(v_day,p_visitor_hash) on conflict do nothing;
  if not found then select unique_visitors into v_count from public.analytics_daily_counts where day=v_day; return coalesce(v_count,0); end if;
  insert into public.analytics_daily_counts(day,unique_visitors,updated_at) values(v_day,1,now())
  on conflict(day) do update set unique_visitors=public.analytics_daily_counts.unique_visitors+1,updated_at=now()
  returning unique_visitors into v_count;
  select max(unique_visitors) into v_previous from public.analytics_daily_counts where day<v_day;
  if v_previous is not null and v_count>v_previous then
    insert into public.admin_notifications(type,title,message,entity_type,entity_id,target_url,metadata,dedupe_key)
    values('analytics.daily_record','Nový rekord návštevnosti','Dnes navštívilo web '||v_count||' unikátnych návštevníkov. Nový rekord!','analytics',v_day::text,'/admin/analytics',jsonb_build_object('day',v_day,'uniqueVisitors',v_count,'previousRecord',v_previous),'analytics:daily-record:'||v_day)
    on conflict(dedupe_key) do nothing;
  end if;
  return v_count;
end $$;
revoke all on function public.analytics_register_daily_visitor(text) from public,anon,authenticated;
grant execute on function public.analytics_register_daily_visitor(text) to service_role;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,username,membership) values(new.id,nullif(btrim(new.raw_user_meta_data->>'username'),''),'free');
  if coalesce(new.raw_app_meta_data->>'role','') <> 'admin' and new.email is not null then
    insert into public.admin_notifications(type,title,message,entity_type,entity_id,target_url,metadata,dedupe_key)
    values('user.created','Nový používateľ',coalesce(nullif(btrim(new.raw_user_meta_data->>'username'),''),new.email)||' sa zaregistroval.','user',new.id::text,'/admin/users/'||new.id,jsonb_build_object('email',new.email),'user:created:'||new.id)
    on conflict(dedupe_key) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
