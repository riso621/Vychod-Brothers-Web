-- The sync Edge Function authenticates to PostgREST with the server-only
-- SUPABASE_SERVICE_ROLE_KEY. RLS bypass does not replace table privileges,
-- so grant only the operations required by the synchronization worker.
grant select, insert, update on table public.social_stats to service_role;

-- Keep browser roles unable to read the internal status/error columns or write
-- provider values directly. Public aggregate reads remain available only via
-- get_public_social_stats().
revoke all on table public.social_stats from anon, authenticated;
grant execute on function public.get_public_social_stats() to service_role;
