create table if not exists public.collaboration_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  company text check (company is null or char_length(company) <= 160),
  email text not null check (char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 40),
  subject text not null check (char_length(trim(subject)) between 2 and 180),
  message text not null check (char_length(trim(message)) between 10 and 5000),
  budget text check (budget is null or char_length(budget) <= 120),
  status text not null default 'new' check (status in ('new','contacted','negotiating','agreed','rejected','archived')),
  internal_note text check (internal_note is null or char_length(internal_note) <= 5000),
  source_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collaboration_messages (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.collaboration_requests(id) on delete cascade,
  direction text not null check (direction in ('incoming','outgoing')),
  sender_email text,
  recipient_email text,
  subject text not null check (char_length(subject) between 1 and 180),
  body text not null check (char_length(body) between 1 and 10000),
  admin_user_id uuid references auth.users(id) on delete set null,
  delivery_status text not null default 'stored' check (delivery_status in ('stored','sent','failed')),
  provider_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists collaboration_requests_status_created_idx on public.collaboration_requests(status, created_at desc);
create index if not exists collaboration_requests_source_created_idx on public.collaboration_requests(source_hash, created_at desc);
create index if not exists collaboration_messages_request_created_idx on public.collaboration_messages(collaboration_id, created_at);
alter table public.collaboration_requests enable row level security;
alter table public.collaboration_messages enable row level security;
revoke all on public.collaboration_requests from anon, authenticated;
revoke all on public.collaboration_messages from anon, authenticated;
grant all on public.collaboration_requests to service_role;
grant all on public.collaboration_messages to service_role;

create or replace function public.set_collaboration_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists collaboration_requests_updated_at on public.collaboration_requests;
create trigger collaboration_requests_updated_at before update on public.collaboration_requests for each row execute function public.set_collaboration_updated_at();
