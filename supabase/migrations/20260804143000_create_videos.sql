create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  description text,
  thumbnail_url text,
  provider text not null,
  provider_video_id text,
  access_level text not null default 'public',
  published boolean not null default false,
  featured boolean not null default false,
  duration text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint videos_slug_key unique (slug),
  constraint videos_title_not_blank_check check (btrim(title) <> ''),
  constraint videos_slug_not_blank_check check (btrim(slug) <> ''),
  constraint videos_provider_check check (provider in ('youtube', 'stream')),
  constraint videos_access_level_check check (access_level in ('public', 'member', 'vip'))
);

alter table public.videos enable row level security;

drop policy if exists "Published videos are publicly readable" on public.videos;
create policy "Published videos are publicly readable"
  on public.videos
  for select
  to anon, authenticated
  using (published = true);

revoke all on table public.videos from anon, authenticated;
grant select on table public.videos to anon, authenticated;

create index if not exists videos_published_created_at_idx
  on public.videos (created_at desc)
  where published = true;

create index if not exists videos_published_access_level_idx
  on public.videos (access_level, created_at desc)
  where published = true;

create index if not exists videos_featured_idx
  on public.videos (created_at desc)
  where published = true and featured = true;

create or replace function public.set_video_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_video_updated_at() from public, anon, authenticated;

drop trigger if exists set_videos_updated_at on public.videos;
create trigger set_videos_updated_at
  before update on public.videos
  for each row
  execute function public.set_video_updated_at();
