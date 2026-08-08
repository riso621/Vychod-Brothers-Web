grant select (id, stripe_customer_id, stripe_subscription_id, stripe_subscription_status)
  on table public.profiles to service_role;

grant update (stripe_customer_id)
  on table public.profiles to service_role;
