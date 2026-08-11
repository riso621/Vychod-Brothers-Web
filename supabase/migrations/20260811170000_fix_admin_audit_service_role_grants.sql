grant select, insert on table public.admin_audit_logs to service_role;

do $$
begin
  if not has_table_privilege('service_role', 'public.admin_audit_logs', 'SELECT')
    or not has_table_privilege('service_role', 'public.admin_audit_logs', 'INSERT')
  then
    raise exception 'service_role audit privileges were not applied';
  end if;
end;
$$;
