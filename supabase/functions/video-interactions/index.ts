import { bearerToken,corsHeaders,json } from '../_shared/http.ts'
import { createAdminClient,createUserClient } from '../_shared/supabase.ts'

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function currentUser(request:Request){
  const token=bearerToken(request)
  if(!token||token.split('.').length!==3)return {token:'',user:null}
  const client=createUserClient(token)
  const {data:{user}}=await client.auth.getUser(token)
  return {token,user:user||null}
}

async function canAccess(admin:ReturnType<typeof createAdminClient>,video:{access_level:string,published:boolean},user:any){
  if(!video.published)return false
  if(video.access_level==='free')return true
  if(!user)return false
  if(user.app_metadata?.role==='admin')return true
  const {data:profile}=await admin.from('profiles').select('membership,membership_status,membership_expires_at').eq('id',user.id).maybeSingle()
  if(!profile||profile.membership_status!=='active'||profile.membership_expires_at&&new Date(profile.membership_expires_at)<=new Date())return false
  return video.access_level==='member'?['member','vip'].includes(profile.membership):profile.membership==='vip'
}

function rpcError(error:any){
  if(error?.code==='42501')return json({error:'Nemáte prístup k interakciám tohto videa.'},403)
  if(error?.code==='22023'||error?.code==='23514')return json({error:'Komentár musí mať 1 až 1 000 znakov.'},400)
  return json({error:'Operáciu sa nepodarilo dokončiť.'},500)
}

Deno.serve(async(request)=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(request.method!=='POST')return json({error:'Method not allowed.'},405)
  let body:any;try{body=await request.json()}catch{return json({error:'Neplatná požiadavka.'},400)}
  const videoId=String(body.videoId||''),action=String(body.action||'get')
  if(!uuid.test(videoId))return json({error:'Neplatné video.'},400)
  const admin=createAdminClient(),auth=await currentUser(request),catalog=createUserClient()
  const {data:video,error:videoError}=await catalog.from('videos').select('id,published,access_level').eq('id',videoId).eq('published',true).maybeSingle()
  if(videoError){console.error('Video interaction lookup failed',videoError.code,videoError.message);return json({error:'Video sa nepodarilo overiť.',code:videoError.code||'query_error'},500)}
  if(!video)return json({error:'Video sa nenašlo.'},404)
  if(!await canAccess(admin,video,auth.user))return json({error:'Nemáte prístup k tomuto videu.'},403)

  if(action==='get'){
    const [{count:likeCount,error:likeError},{data:comments,count:commentCount,error:commentError}]=await Promise.all([
      admin.from('video_likes').select('user_id',{count:'exact',head:true}).eq('video_id',videoId),
      admin.from('video_comments').select('id,user_id,body,created_at',{count:'exact'}).eq('video_id',videoId).eq('status','visible').order('created_at',{ascending:false}).limit(100),
    ])
    if(likeError||commentError)return json({error:'Interakcie sa nepodarilo načítať.'},500)
    const userIds=[...new Set((comments||[]).map((item:any)=>item.user_id))]
    const {data:profiles}=userIds.length?await admin.from('profiles').select('id,username').in('id',userIds):{data:[]}
    const names=new Map((profiles||[]).map((profile:any)=>[profile.id,profile.username?.trim()||'Člen komunity']))
    let liked=false
    if(auth.user){const {count}=await admin.from('video_likes').select('user_id',{count:'exact',head:true}).eq('video_id',videoId).eq('user_id',auth.user.id);liked=(count||0)>0}
    return json({likeCount:likeCount||0,liked,commentCount:commentCount||0,comments:(comments||[]).map((comment:any)=>({id:comment.id,body:comment.body,createdAt:comment.created_at,authorName:names.get(comment.user_id)||'Člen komunity',isOwn:comment.user_id===auth.user?.id}))})
  }

  if(!auth.user||!auth.token)return json({error:'Prihlásenie je povinné.'},401)
  const client=createUserClient(auth.token)
  if(action==='toggle-like'){
    const {data,error}=await client.rpc('toggle_video_like',{p_video_id:videoId})
    if(error)return rpcError(error)
    return json({liked:Boolean(data?.[0]?.liked),likeCount:Number(data?.[0]?.like_count||0)})
  }
  if(action==='add-comment'){
    const text=String(body.text||'').trim()
    if(text.length<1||text.length>1000)return json({error:'Komentár musí mať 1 až 1 000 znakov.'},400)
    const {data,error}=await client.rpc('add_video_comment',{p_video_id:videoId,p_body:text})
    if(error)return rpcError(error)
    const row=data?.[0]
    const {data:profile}=await admin.from('profiles').select('username').eq('id',auth.user.id).maybeSingle()
    return json({comment:{id:row.id,body:row.body,createdAt:row.created_at,authorName:profile?.username?.trim()||'Člen komunity',isOwn:true}})
  }
  if(action==='delete-comment'){
    const commentId=String(body.commentId||'')
    if(!uuid.test(commentId))return json({error:'Neplatný komentár.'},400)
    const {data,error}=await client.rpc('delete_own_video_comment',{p_comment_id:commentId})
    if(error)return rpcError(error)
    return data?json({ok:true}):json({error:'Komentár sa nenašiel alebo ho nemôžete odstrániť.'},404)
  }
  return json({error:'Neplatná operácia.'},400)
})
