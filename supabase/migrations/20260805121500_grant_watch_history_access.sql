revoke all on table public.watch_history from anon;
revoke all on table public.watch_history from authenticated;

grant select, insert, update on table public.watch_history to authenticated;
