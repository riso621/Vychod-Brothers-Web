import { bearerToken,corsHeaders,json } from '../_shared/http.ts'
import { createAdminClient,createUserClient } from '../_shared/supabase.ts'

async function requireAdmin(request:Request){const token=bearerToken(request);if(!token)return null;const client=createUserClient(token);const {data:{user}}=await client.auth.getUser(token);return user?.app_metadata?.role==='admin'?user:null}
Deno.serve(async(request)=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
 if(request.method!=='POST')return json({error:'Method not allowed.'},405)
 const user=await requireAdmin(request);if(!user)return json({error:'Nemáte oprávnenie.'},403)
 let body:any;try{body=await request.json()}catch{body={}}
 const admin=createAdminClient(),action=String(body.action||'list')
 if(action==='list'){
  const limit=Math.min(50,Math.max(1,Number(body.limit)||20))
  const [{data,error},{count,error:countError}]=await Promise.all([admin.from('admin_notifications').select('id,type,title,message,entity_type,entity_id,target_url,metadata,created_at,read_at').order('created_at',{ascending:false}).limit(limit),admin.from('admin_notifications').select('id',{count:'exact',head:true}).is('read_at',null)])
  return error||countError?json({error:'Notifikácie sa nepodarilo načítať.'},500):json({notifications:data||[],unreadCount:count||0})
 }
 if(action==='read'){
  const id=String(body.id||'');if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:'Neplatná notifikácia.'},400)
  const {error}=await admin.from('admin_notifications').update({read_at:new Date().toISOString(),read_by:user.id}).eq('id',id).is('read_at',null)
  return error?json({error:'Notifikáciu sa nepodarilo označiť.'},500):json({ok:true})
 }
 if(action==='read-all'){
  const {error}=await admin.from('admin_notifications').update({read_at:new Date().toISOString(),read_by:user.id}).is('read_at',null)
  return error?json({error:'Notifikácie sa nepodarilo označiť.'},500):json({ok:true})
 }
 return json({error:'Neplatná operácia.'},400)
})
