create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('video_published')),
  video_id uuid references public.videos(id) on delete set null,
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','completed','partial','failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.email_campaigns(id) on delete cascade,
  event_type text not null,
  user_id uuid references auth.users(id) on delete cascade,
  video_id uuid references public.videos(id) on delete set null,
  dedupe_key text not null unique,
  provider_message_id text,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  content_notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_deliveries_status_created_idx on public.email_deliveries(status, created_at);
create index if not exists email_deliveries_user_created_idx on public.email_deliveries(user_id, created_at desc);
create index if not exists email_campaigns_created_idx on public.email_campaigns(created_at desc);

alter table public.email_campaigns enable row level security;
alter table public.email_deliveries enable row level security;
alter table public.email_preferences enable row level security;
revoke all on public.email_campaigns, public.email_deliveries from public, anon, authenticated;
revoke all on public.email_preferences from public, anon;
grant all on public.email_campaigns, public.email_deliveries, public.email_preferences to service_role;
grant select, update (content_notifications_enabled) on public.email_preferences to authenticated;

drop policy if exists "Users read own email preferences" on public.email_preferences;
create policy "Users read own email preferences" on public.email_preferences for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users update own email preferences" on public.email_preferences;
create policy "Users update own email preferences" on public.email_preferences for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.queue_member_video_email(p_video_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.videos%rowtype;
  campaign uuid;
begin
  select * into target from public.videos where id = p_video_id;
  if not found or not target.published or target.access_level not in ('member','vip') then
    return null;
  end if;

  insert into public.email_campaigns(event_type, video_id, dedupe_key, payload)
  values ('video_published', target.id, 'video-published:' || target.id::text,
    jsonb_build_object('title', target.title, 'slug', target.slug, 'description', target.description))
  on conflict (dedupe_key) do update set dedupe_key = excluded.dedupe_key
  returning id into campaign;

  insert into public.email_deliveries(campaign_id,event_type,user_id,video_id,dedupe_key)
  select campaign,'video_published',profile.id,target.id,'video-published:'||target.id::text||':user:'||profile.id::text
  from public.profiles profile
  left join public.email_preferences preference on preference.user_id=profile.id
  where profile.membership in ('member','vip')
    and profile.membership_status='active'
    and (profile.membership_expires_at is null or profile.membership_expires_at > now())
    and coalesce(preference.content_notifications_enabled,true)
  on conflict (dedupe_key) do nothing;

  return campaign;
end;
$$;

revoke all on function public.queue_member_video_email(uuid) from public,anon,authenticated;
grant execute on function public.queue_member_video_email(uuid) to service_role;

comment on table public.email_deliveries is 'Server-only delivery log and idempotency ledger. No email bodies or credentials are stored.';
comment on function public.queue_member_video_email(uuid) is 'Queues one deduplicated content notification per entitled user on first video publish.';
