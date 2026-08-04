begin;

alter table public.videos
  drop constraint if exists videos_provider_check;

alter table public.videos
  add constraint videos_provider_check
  check (provider in ('youtube', 'stream', 'cloudflare_stream'));

commit;
