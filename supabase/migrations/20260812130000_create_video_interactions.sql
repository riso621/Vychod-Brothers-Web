create table if not exists public.video_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  status text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  moderated_at timestamptz,
  moderated_by uuid references auth.users(id) on delete set null,
  constraint video_comments_body_check check (char_length(btrim(body)) between 1 and 1000),
  constraint video_comments_status_check check (status in ('visible','hidden','deleted'))
);

create index if not exists video_likes_video_created_idx on public.video_likes(video_id, created_at desc);
create index if not exists video_comments_video_status_created_idx on public.video_comments(video_id, status, created_at desc);
create index if not exists video_comments_user_created_idx on public.video_comments(user_id, created_at desc);

alter table public.video_likes enable row level security;
alter table public.video_comments enable row level security;
revoke all on public.video_likes from public, anon, authenticated;
revoke all on public.video_comments from public, anon, authenticated;
grant all on public.video_likes to service_role;
grant all on public.video_comments to service_role;

create or replace function public.can_interact_with_video(p_video_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1
    from public.videos video
    where video.id=p_video_id and video.published=true and (
      (auth.uid()=p_user_id and coalesce(auth.jwt()->'app_metadata'->>'role','')='admin')
      or video.access_level='free'
      or exists (
        select 1 from public.profiles profile
        where profile.id=p_user_id
          and profile.membership_status='active'
          and (profile.membership_expires_at is null or profile.membership_expires_at>now())
          and (
            (video.access_level='member' and profile.membership in ('member','vip'))
            or (video.access_level='vip' and profile.membership='vip')
          )
      )
    )
  );
$$;
revoke all on function public.can_interact_with_video(uuid,uuid) from public,anon,authenticated;
grant execute on function public.can_interact_with_video(uuid,uuid) to service_role;

create or replace function public.toggle_video_like(p_video_id uuid)
returns table(liked boolean, like_count bigint) language plpgsql security definer set search_path='' as $$
declare
  v_user_id uuid:=auth.uid();
  v_liked boolean;
  v_count bigint;
  v_title text;
  v_milestones constant integer[]:=array[10,25,50,100,250,500,1000,2500,5000,10000];
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.can_interact_with_video(p_video_id,v_user_id) then raise exception 'Video access denied' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext(p_video_id::text));
  delete from public.video_likes where user_id=v_user_id and video_id=p_video_id;
  if found then
    v_liked:=false;
  else
    insert into public.video_likes(user_id,video_id) values(v_user_id,p_video_id);
    v_liked:=true;
  end if;
  select count(*) into v_count from public.video_likes where video_id=p_video_id;
  if v_liked and v_count::integer=any(v_milestones) then
    select title into v_title from public.videos where id=p_video_id;
    insert into public.admin_notifications(type,title,message,entity_type,entity_id,target_url,metadata,dedupe_key)
    values('video.like_milestone','Video dosiahlo '||v_count||' srdiečok',v_title||' práve dosiahlo '||v_count||' srdiečok.','video',p_video_id::text,'/admin/videos/'||p_video_id||'/comments',jsonb_build_object('videoId',p_video_id,'milestone',v_count),'video:like-milestone:'||p_video_id||':'||v_count)
    on conflict(dedupe_key) do nothing;
  end if;
  return query select v_liked,v_count;
end $$;
revoke all on function public.toggle_video_like(uuid) from public,anon;
grant execute on function public.toggle_video_like(uuid) to authenticated;

create or replace function public.add_video_comment(p_video_id uuid,p_body text)
returns table(id uuid,body text,status text,created_at timestamptz) language plpgsql security definer set search_path='' as $$
declare
  v_user_id uuid:=auth.uid();
  v_body text:=btrim(coalesce(p_body,''));
  v_comment public.video_comments%rowtype;
  v_video_title text;
  v_author text;
  v_preview text;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if char_length(v_body)<1 or char_length(v_body)>1000 then raise exception 'Invalid comment length' using errcode='22023'; end if;
  if not public.can_interact_with_video(p_video_id,v_user_id) then raise exception 'Video access denied' using errcode='42501'; end if;
  insert into public.video_comments(video_id,user_id,body) values(p_video_id,v_user_id,v_body) returning * into v_comment;
  select video.title into v_video_title from public.videos video where video.id=p_video_id;
  select coalesce(nullif(btrim(profile.username),''),'Člen komunity') into v_author from public.profiles profile where profile.id=v_user_id;
  v_preview:=left(regexp_replace(v_body,'\s+',' ','g'),90);
  if char_length(v_body)>90 then v_preview:=v_preview||'…'; end if;
  insert into public.admin_notifications(type,title,message,entity_type,entity_id,target_url,metadata,dedupe_key)
  values('video.comment','Nový komentár',v_author||' komentoval video '||v_video_title||' · „'||v_preview||'“','video_comment',v_comment.id::text,'/admin/videos/'||p_video_id||'/comments',jsonb_build_object('videoId',p_video_id,'commentId',v_comment.id),'video:comment:'||v_comment.id)
  on conflict(dedupe_key) do nothing;
  return query select v_comment.id,v_comment.body,v_comment.status,v_comment.created_at;
end $$;
revoke all on function public.add_video_comment(uuid,text) from public,anon;
grant execute on function public.add_video_comment(uuid,text) to authenticated;

create or replace function public.delete_own_video_comment(p_comment_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  update public.video_comments set status='deleted',deleted_at=now(),updated_at=now()
  where id=p_comment_id and user_id=v_user_id and status<>'deleted';
  return found;
end $$;
revoke all on function public.delete_own_video_comment(uuid) from public,anon;
grant execute on function public.delete_own_video_comment(uuid) to authenticated;

create or replace function public.set_video_comment_updated_at()
returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now();return new;end $$;
drop trigger if exists set_video_comment_updated_at on public.video_comments;
create trigger set_video_comment_updated_at before update on public.video_comments for each row execute function public.set_video_comment_updated_at();
revoke all on function public.set_video_comment_updated_at() from public,anon,authenticated;

create or replace view public.video_interaction_stats with (security_invoker=true) as
select video.id as video_id,
  count(distinct likes.user_id)::bigint as like_count,
  count(distinct comments.id) filter(where comments.status='visible')::bigint as comment_count
from public.videos video
left join public.video_likes likes on likes.video_id=video.id
left join public.video_comments comments on comments.video_id=video.id
group by video.id;
revoke all on public.video_interaction_stats from public,anon,authenticated;
grant select on public.video_interaction_stats to service_role;
