create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_user_id uuid references auth.users(id) on delete set null,
  admin_email text,
  action_type text not null check (btrim(action_type) <> ''),
  entity_type text not null check (btrim(entity_type) <> ''),
  entity_id text,
  description text not null default '',
  before_data jsonb,
  after_data jsonb
);
alter table public.admin_audit_logs enable row level security;
revoke all on table public.admin_audit_logs from public, anon, authenticated;
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_entity_idx on public.admin_audit_logs(entity_type, entity_id);
create index if not exists admin_audit_logs_admin_idx on public.admin_audit_logs(admin_user_id, created_at desc);

create table if not exists public.site_content (
  key text primary key check (key ~ '^[a-z0-9_.-]+$'),
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.site_content enable row level security;
revoke all on table public.site_content from public, anon, authenticated;
grant select on table public.site_content to anon, authenticated;
drop policy if exists "Public site content is readable" on public.site_content;
create policy "Public site content is readable" on public.site_content for select to anon, authenticated using (true);

create or replace function public.set_site_content_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function public.set_site_content_updated_at() from public, anon, authenticated;
drop trigger if exists set_site_content_updated_at on public.site_content;
create trigger set_site_content_updated_at before update on public.site_content
for each row execute function public.set_site_content_updated_at();

insert into public.site_content(key, value, description) values
  ('brand.name', '"Východ Brothers"', 'Verejný názov projektu'),
  ('contact.email', '"ahoj@vychodbrothers.sk"', 'Verejný kontaktný e-mail'),
  ('support.email', '"ahoj@vychodbrothers.sk"', 'E-mail zákazníckej podpory'),
  ('homepage.hero.headline', '"VÝCHOD BROTHERS"', 'Hlavný titulok homepage'),
  ('homepage.hero.subtitle', '"PARÓDIE. MINIFILMY. ZÁBAVA. TO JE NÁŠ SVET."', 'Podtitulok homepage')
on conflict (key) do nothing;
