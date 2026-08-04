insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('videos', 'videos', false, 5368709120, array['video/mp4']),
  ('thumbnails', 'thumbnails', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload private media" on storage.objects;
create policy "Admins can upload private media"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id in ('videos', 'thumbnails')
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

drop policy if exists "Admins can read private media" on storage.objects;
create policy "Admins can read private media"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id in ('videos', 'thumbnails')
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

drop policy if exists "Published thumbnails are signable" on storage.objects;
create policy "Published thumbnails are signable"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'thumbnails'
    and exists (
      select 1
      from public.videos
      where published = true
        and thumbnail_url = storage.objects.name
    )
  );

drop policy if exists "Accessible videos are signable" on storage.objects;
create policy "Accessible videos are signable"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'videos'
    and exists (
      select 1
      from public.videos video
      where video.published = true
        and video.provider_video_id = storage.objects.name
        and (
          video.access_level = 'public'
          or (
            video.access_level = 'member'
            and exists (
              select 1 from public.profiles profile
              where profile.id = auth.uid()
                and profile.membership in ('member', 'vip')
            )
          )
          or (
            video.access_level = 'vip'
            and exists (
              select 1 from public.profiles profile
              where profile.id = auth.uid()
                and profile.membership = 'vip'
            )
          )
        )
    )
  );

drop policy if exists "Admins can delete private media" on storage.objects;
create policy "Admins can delete private media"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id in ('videos', 'thumbnails')
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );
