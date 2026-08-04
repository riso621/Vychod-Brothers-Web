drop policy if exists "Admins can insert videos" on public.videos;
create policy "Admins can insert videos"
  on public.videos
  for insert
  to authenticated
  with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

revoke insert on table public.videos from anon, authenticated;
grant insert (
  title,
  slug,
  description,
  thumbnail_url,
  provider,
  provider_video_id,
  access_level,
  published,
  featured,
  duration
) on table public.videos to authenticated;
