create table if not exists public.viewer_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  avatar_key text not null default 'vb-red',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint viewer_profiles_name_check check (char_length(btrim(name)) between 1 and 32),
  constraint viewer_profiles_avatar_check check (avatar_key in ('vb-red','vb-dark','vb-slate','vb-crimson'))
);

create unique index if not exists viewer_profiles_one_primary_idx on public.viewer_profiles(owner_id) where is_primary;
create index if not exists viewer_profiles_owner_created_idx on public.viewer_profiles(owner_id, created_at);

create or replace function public.enforce_viewer_profile_rules()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 7419));
  new.name := btrim(new.name);
  if tg_op='INSERT' and (select count(*) from public.viewer_profiles where owner_id=new.owner_id) >= 4 then
    raise exception 'Maximum of 4 viewer profiles reached' using errcode='P0001';
  end if;
  if tg_op='UPDATE' and new.owner_id is distinct from old.owner_id then
    raise exception 'Profile owner cannot be changed' using errcode='42501';
  end if;
  if tg_op='UPDATE' and old.is_primary and not new.is_primary then
    raise exception 'Primary profile cannot be demoted' using errcode='42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.enforce_viewer_profile_rules() from public,anon,authenticated;

drop trigger if exists enforce_viewer_profile_rules on public.viewer_profiles;
create trigger enforce_viewer_profile_rules before insert or update on public.viewer_profiles
for each row execute function public.enforce_viewer_profile_rules();

create or replace function public.protect_primary_viewer_profile()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.is_primary then raise exception 'Primary profile cannot be deleted' using errcode='42501'; end if;
  return old;
end $$;
revoke all on function public.protect_primary_viewer_profile() from public,anon,authenticated;
drop trigger if exists protect_primary_viewer_profile on public.viewer_profiles;
create trigger protect_primary_viewer_profile before delete on public.viewer_profiles
for each row execute function public.protect_primary_viewer_profile();

alter table public.viewer_profiles enable row level security;
drop policy if exists "Owners can read viewer profiles" on public.viewer_profiles;
create policy "Owners can read viewer profiles" on public.viewer_profiles for select to authenticated using (owner_id=(select auth.uid()));
drop policy if exists "Owners can create viewer profiles" on public.viewer_profiles;
create policy "Owners can create viewer profiles" on public.viewer_profiles for insert to authenticated with check (owner_id=(select auth.uid()));
drop policy if exists "Owners can update viewer profiles" on public.viewer_profiles;
create policy "Owners can update viewer profiles" on public.viewer_profiles for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
drop policy if exists "Owners can delete viewer profiles" on public.viewer_profiles;
create policy "Owners can delete viewer profiles" on public.viewer_profiles for delete to authenticated using (owner_id=(select auth.uid()) and not is_primary);
revoke all on public.viewer_profiles from anon,authenticated;
grant select,insert,update,delete on public.viewer_profiles to authenticated;

insert into public.viewer_profiles(owner_id,name,avatar_key,is_primary)
select p.id,coalesce(nullif(split_part(btrim(p.username),' ',1),''),'Profil'),'vb-red',true
from public.profiles p where not exists(select 1 from public.viewer_profiles v where v.owner_id=p.id);

create or replace function public.create_primary_viewer_profile()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.viewer_profiles(owner_id,name,avatar_key,is_primary)
  values(new.id,coalesce(nullif(split_part(btrim(new.username),' ',1),''),'Profil'),'vb-red',true)
  on conflict do nothing;
  return new;
end $$;
revoke all on function public.create_primary_viewer_profile() from public,anon,authenticated;
drop trigger if exists create_primary_viewer_profile on public.profiles;
create trigger create_primary_viewer_profile after insert on public.profiles
for each row execute function public.create_primary_viewer_profile();

alter table public.watch_history add column if not exists viewer_profile_id uuid references public.viewer_profiles(id) on delete cascade;
update public.watch_history h set viewer_profile_id=v.id from public.viewer_profiles v
where v.owner_id=h.user_id and v.is_primary and h.viewer_profile_id is null;
alter table public.watch_history alter column viewer_profile_id set not null;
alter table public.watch_history drop constraint if exists watch_history_user_video_key;
alter table public.watch_history add constraint watch_history_profile_video_key unique(viewer_profile_id,video_id);
create index if not exists watch_history_profile_recent_idx on public.watch_history(viewer_profile_id,last_watched_at desc);

drop policy if exists "Users can read own watch history" on public.watch_history;
create policy "Users can read own watch history" on public.watch_history for select to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.viewer_profiles v where v.id=viewer_profile_id and v.owner_id=(select auth.uid())));
drop policy if exists "Users can insert own watch history" on public.watch_history;
create policy "Users can insert own watch history" on public.watch_history for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.viewer_profiles v where v.id=viewer_profile_id and v.owner_id=(select auth.uid())));
drop policy if exists "Users can update own watch history" on public.watch_history;
create policy "Users can update own watch history" on public.watch_history for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.viewer_profiles v where v.id=viewer_profile_id and v.owner_id=(select auth.uid())))
with check (user_id=(select auth.uid()) and exists(select 1 from public.viewer_profiles v where v.id=viewer_profile_id and v.owner_id=(select auth.uid())));

create table if not exists public.viewer_favorites (
  viewer_profile_id uuid not null references public.viewer_profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(viewer_profile_id,video_id)
);
alter table public.viewer_favorites enable row level security;
create policy "Owners can read viewer favorites" on public.viewer_favorites for select to authenticated
using (exists(select 1 from public.viewer_profiles v where v.id=viewer_profile_id and v.owner_id=(select auth.uid())));
create policy "Owners can add viewer favorites" on public.viewer_favorites for insert to authenticated
with check (exists(select 1 from public.viewer_profiles v where v.id=viewer_profile_id and v.owner_id=(select auth.uid())));
create policy "Owners can remove viewer favorites" on public.viewer_favorites for delete to authenticated
using (exists(select 1 from public.viewer_profiles v where v.id=viewer_profile_id and v.owner_id=(select auth.uid())));
revoke all on public.viewer_favorites from anon,authenticated;
grant select,insert,delete on public.viewer_favorites to authenticated;
