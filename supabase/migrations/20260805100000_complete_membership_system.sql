alter table public.profiles
  add column if not exists membership_started_at timestamptz,
  add column if not exists membership_expires_at timestamptz,
  add column if not exists membership_status text not null default 'active';

update public.profiles
set membership_started_at = created_at
where membership_started_at is null;

alter table public.profiles
  alter column membership_started_at set default now(),
  alter column membership_started_at set not null;

alter table public.profiles drop constraint if exists profiles_membership_status_check;
alter table public.profiles
  add constraint profiles_membership_status_check
  check (membership_status in ('active', 'expired', 'cancelled'));

alter table public.profiles drop constraint if exists profiles_membership_dates_check;
alter table public.profiles
  add constraint profiles_membership_dates_check
  check (
    membership_status <> 'active'
    or membership_expires_at is null
    or membership_expires_at > membership_started_at
  );

alter table public.videos drop constraint if exists videos_access_level_check;
update public.videos set access_level = 'free' where access_level = 'public';
alter table public.videos alter column access_level set default 'free';
alter table public.videos
  add constraint videos_access_level_check
  check (access_level in ('free', 'member', 'vip'));

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
          video.access_level = 'free'
          or (
            video.access_level = 'member'
            and exists (
              select 1 from public.profiles profile
              where profile.id = auth.uid()
                and profile.membership in ('member', 'vip')
                and profile.membership_status = 'active'
                and (profile.membership_expires_at is null or profile.membership_expires_at > now())
            )
          )
          or (
            video.access_level = 'vip'
            and exists (
              select 1 from public.profiles profile
              where profile.id = auth.uid()
                and profile.membership = 'vip'
                and profile.membership_status = 'active'
                and (profile.membership_expires_at is null or profile.membership_expires_at > now())
            )
          )
        )
    )
  );
