-- Non-destructive compatibility layer for the single Vychod Brothers Club plan.
-- Legacy member/vip values stay intact for historical subscriptions and invoices.

alter table public.profiles
  add column if not exists membership_plan text;

alter table public.profiles
  drop constraint if exists profiles_membership_plan_check;

alter table public.profiles
  add constraint profiles_membership_plan_check
  check (membership_plan is null or membership_plan in ('member', 'vip', 'club'));

update public.profiles
set membership_plan = membership
where membership_plan is null
  and membership in ('member', 'vip');

alter table public.videos
  add column if not exists trailer_provider_video_id text;

comment on column public.profiles.membership_plan is
  'Billing product identifier. Legacy member/vip values are preserved; new subscriptions use club.';

comment on column public.videos.trailer_provider_video_id is
  'Public Cloudflare Stream UID for a separate marketing trailer. Never the protected full-video UID.';

create or replace function public.can_interact_with_video(target_video_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.videos video
    where video.id = target_video_id
      and video.published = true
      and (
        video.access_level = 'free'
        or exists (
          select 1
          from public.profiles profile
          where profile.id = auth.uid()
            and profile.membership in ('member', 'vip')
            and profile.membership_status = 'active'
            and (profile.membership_expires_at is null or profile.membership_expires_at > now())
        )
      )
  );
$$;

revoke all on function public.can_interact_with_video(uuid) from public;
grant execute on function public.can_interact_with_video(uuid) to authenticated;
