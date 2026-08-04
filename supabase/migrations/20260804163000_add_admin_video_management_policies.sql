drop policy if exists "Admins can read all videos" on public.videos;
create policy "Admins can read all videos"
  on public.videos
  for select
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

drop policy if exists "Admins can update videos" on public.videos;
create policy "Admins can update videos"
  on public.videos
  for update
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  )
  with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

drop policy if exists "Admins can delete videos" on public.videos;
create policy "Admins can delete videos"
  on public.videos
  for delete
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

revoke update, delete on table public.videos from anon, authenticated;
grant update (
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
grant delete on table public.videos to authenticated;
