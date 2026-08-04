create table if not exists public.profiles (
  id uuid primary key,
  username text,
  avatar_url text,
  membership text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_id_fkey
    foreign key (id) references auth.users (id) on delete cascade,
  constraint profiles_membership_check
    check (membership in ('free', 'member', 'vip')),
  constraint profiles_username_not_blank_check
    check (username is null or btrim(username) <> '')
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke all on table public.profiles from anon;
revoke insert, delete, update on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (username, avatar_url) on table public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, membership)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
    'free'
  );

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_profile_updated_at() from public, anon, authenticated;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profile_updated_at();
