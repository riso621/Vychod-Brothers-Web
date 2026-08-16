-- Admin video writes run exclusively inside authenticated, admin-authorized
-- Edge Functions. RLS remains enabled and browser roles keep their existing
-- restricted grants.
grant select, insert, update, delete on table public.videos to service_role;

do $$
begin
  if not has_table_privilege('service_role', 'public.videos', 'SELECT')
    or not has_table_privilege('service_role', 'public.videos', 'INSERT')
    or not has_table_privilege('service_role', 'public.videos', 'UPDATE')
    or not has_table_privilege('service_role', 'public.videos', 'DELETE')
  then
    raise exception 'service_role video privileges were not applied';
  end if;
end;
$$;
