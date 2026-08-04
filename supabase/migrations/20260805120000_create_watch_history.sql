create table if not exists public.watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  position_seconds integer not null default 0,
  duration_seconds integer,
  progress_percent numeric(5, 2),
  completed boolean not null default false,
  started_at timestamptz not null default now(),
  last_watched_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint watch_history_user_video_key unique (user_id, video_id),
  constraint watch_history_position_check check (position_seconds >= 0),
  constraint watch_history_duration_check check (duration_seconds is null or duration_seconds >= 0),
  constraint watch_history_progress_check check (progress_percent is null or progress_percent between 0 and 100)
);

create index if not exists watch_history_user_recent_idx
  on public.watch_history (user_id, last_watched_at desc);

alter table public.watch_history enable row level security;

drop policy if exists "Users can read own watch history" on public.watch_history;
create policy "Users can read own watch history"
  on public.watch_history for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own watch history" on public.watch_history;
create policy "Users can insert own watch history"
  on public.watch_history for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own watch history" on public.watch_history;
create policy "Users can update own watch history"
  on public.watch_history for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.set_watch_history_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_watch_history_updated_at() from public, anon, authenticated;

drop trigger if exists set_watch_history_updated_at on public.watch_history;
create trigger set_watch_history_updated_at
  before update on public.watch_history
  for each row
  execute function public.set_watch_history_updated_at();

