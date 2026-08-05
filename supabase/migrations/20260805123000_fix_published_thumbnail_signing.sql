drop policy if exists "Accessible videos are signable" on storage.objects;

create policy "Accessible videos are signable"
  on storage.objects
  for select
  to anon, authenticated
  using (
    case
      when bucket_id = 'videos' then exists (
        select 1
        from public.videos video
        where video.published = true
          and video.provider_video_id = storage.objects.name
          and (
            video.access_level = 'free'
            or (
              video.access_level = 'member'
              and exists (
                select 1
                from public.profiles profile
                where profile.id = auth.uid()
                  and profile.membership in ('member', 'vip')
                  and profile.membership_status = 'active'
                  and (profile.membership_expires_at is null or profile.membership_expires_at > now())
              )
            )
            or (
              video.access_level = 'vip'
              and exists (
                select 1
                from public.profiles profile
                where profile.id = auth.uid()
                  and profile.membership = 'vip'
                  and profile.membership_status = 'active'
                  and (profile.membership_expires_at is null or profile.membership_expires_at > now())
              )
            )
          )
      )
      else false
    end
  );
