alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_subscription_status text,
  add column if not exists stripe_cancel_at_period_end boolean not null default false,
  add column if not exists stripe_last_event_created_at timestamptz;

alter table public.profiles drop constraint if exists profiles_stripe_subscription_status_check;
alter table public.profiles add constraint profiles_stripe_subscription_status_check
  check (stripe_subscription_status is null or stripe_subscription_status in (
    'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due',
    'canceled', 'unpaid', 'paused'
  ));

create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles (stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists profiles_stripe_subscription_id_key
  on public.profiles (stripe_subscription_id) where stripe_subscription_id is not null;

revoke update (stripe_customer_id, stripe_subscription_id, stripe_price_id,
  stripe_subscription_status, stripe_cancel_at_period_end, stripe_last_event_created_at)
  on table public.profiles from authenticated;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  stripe_created_at timestamptz,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_webhook_events from public, anon, authenticated;

create or replace function public.apply_stripe_subscription_event(
  p_event_id text,
  p_event_type text,
  p_stripe_created_at timestamptz,
  p_user_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_price_id text,
  p_subscription_status text,
  p_membership text,
  p_membership_status text,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_membership not in ('free', 'member', 'vip')
    or p_membership_status not in ('active', 'expired', 'cancelled')
    or p_subscription_status not in (
      'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due',
      'canceled', 'unpaid', 'paused'
    )
  then
    raise exception 'Invalid Stripe membership state' using errcode = '22023';
  end if;

  if exists (select 1 from public.stripe_webhook_events where event_id = p_event_id) then
    return false;
  end if;

  update public.profiles
  set stripe_customer_id = p_customer_id,
      stripe_subscription_id = p_subscription_id,
      stripe_price_id = p_price_id,
      stripe_subscription_status = p_subscription_status,
      stripe_cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
      stripe_last_event_created_at = p_stripe_created_at,
      membership = p_membership,
      membership_status = p_membership_status,
      membership_started_at = case
        when p_membership <> 'free' and membership is distinct from p_membership then now()
        else membership_started_at
      end,
      membership_expires_at = p_period_end
  where id = p_user_id
    and (stripe_last_event_created_at is null or p_stripe_created_at >= stripe_last_event_created_at);

  if not found then
    if not exists (select 1 from public.profiles where id = p_user_id) then
      raise exception 'Stripe user profile not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.stripe_webhook_events (event_id, event_type, stripe_created_at)
  values (p_event_id, p_event_type, p_stripe_created_at);
  return true;
end;
$$;

revoke all on function public.apply_stripe_subscription_event(
  text, text, timestamptz, uuid, text, text, text, text, text, text,
  timestamptz, boolean
) from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_event(
  text, text, timestamptz, uuid, text, text, text, text, text, text,
  timestamptz, boolean
) to service_role;
