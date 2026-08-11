-- Server-side admin and interaction endpoints need to resolve video metadata.
-- This grant is limited to Supabase's trusted service role; client roles remain unchanged.
grant select on table public.videos to service_role;
