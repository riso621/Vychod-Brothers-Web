import { bearerToken, corsHeaders, json } from '../_shared/http.ts'
import { createAdminClient, createUserClient } from '../_shared/supabase.ts'

const statuses=new Set(['new','contacted','negotiating','agreed','rejected','archived'])
async function requireAdmin(request:Request){const token=bearerToken(request);if(!token)return{error:json({error:'Prihlásenie je povinné.'},401)};const client=createUserClient(token);const {data:{user},error}=await client.auth.getUser(token);if(error||!user)return{error:json({error:'Prihlásenie nie je platné.'},401)};if(user.app_metadata?.role!=='admin')return{error:json({error:'Nemáte oprávnenie.'},403)};return{user}}
const clean=(value:unknown,max:number)=>String(value||'').trim().slice(0,max)

Deno.serve(async(request)=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(request.method!=='POST')return json({error:'Method not allowed.'},405)
  const auth=await requireAdmin(request);if(auth.error)return auth.error
  let body:any;try{body=await request.json()}catch{return json({error:'Neplatná požiadavka.'},400)}
  const admin=createAdminClient()
  if(body.action==='summary'){const {count,error}=await admin.from('collaboration_requests').select('id',{count:'exact',head:true}).eq('status','new');return error?json({error:'Súhrn sa nepodarilo načítať.'},500):json({newCount:count||0})}
  if(body.action==='list'){
    const limit=Math.min(100,Math.max(1,Number(body.limit)||50)),offset=Math.max(0,Number(body.offset)||0),status=clean(body.status,20),search=clean(body.search,120)
    let query=admin.from('collaboration_requests').select('id,name,company,email,subject,budget,status,created_at,updated_at',{count:'exact'}).order('created_at',{ascending:false}).range(offset,offset+limit-1)
    if(status&&status!=='all'&&statuses.has(status))query=query.eq('status',status)
    if(search)query=query.or(`name.ilike.%${search.replace(/[%_,()]/g,'')}%,company.ilike.%${search.replace(/[%_,()]/g,'')}%,email.ilike.%${search.replace(/[%_,()]/g,'')}%`)
    const {data,error,count}=await query;return error?json({error:'Spolupráce sa nepodarilo načítať.'},500):json({requests:data||[],total:count||0})
  }
  if(body.action==='detail'){
    const id=clean(body.id,36);const [{data:item,error},{data:messages}]=await Promise.all([admin.from('collaboration_requests').select('id,name,company,email,phone,subject,message,budget,status,internal_note,created_at,updated_at').eq('id',id).maybeSingle(),admin.from('collaboration_messages').select('id,direction,sender_email,recipient_email,subject,body,delivery_status,created_at,admin_user_id').eq('collaboration_id',id).order('created_at')]);return error||!item?json({error:'Spolupráca sa nenašla.'},404):json({request:item,messages:messages||[]})
  }
  if(body.action==='status'){
    const id=clean(body.id,36),status=clean(body.status,20);if(!statuses.has(status))return json({error:'Neplatný stav.'},400)
    const {data:before}=await admin.from('collaboration_requests').select('status').eq('id',id).maybeSingle();if(!before)return json({error:'Spolupráca sa nenašla.'},404)
    const {error}=await admin.from('collaboration_requests').update({status}).eq('id',id);if(error)return json({error:'Stav sa nepodarilo zmeniť.'},500)
    await admin.from('admin_audit_logs').insert({admin_user_id:auth.user!.id,admin_email:auth.user!.email,action_type:status==='archived'?'collaboration.archive':'collaboration.status',entity_type:'collaboration',entity_id:id,description:`Stav spolupráce zmenený z ${before.status} na ${status}`,before_data:{status:before.status},after_data:{status}});return json({ok:true})
  }
  if(body.action==='reply'){
    const id=clean(body.id,36),subject=clean(body.subject,180),message=clean(body.message,10000);if(subject.length<2||message.length<2)return json({error:'Predmet a odpoveď sú povinné.'},400)
    const {data:item}=await admin.from('collaboration_requests').select('id,email,status').eq('id',id).maybeSingle();if(!item)return json({error:'Spolupráca sa nenašla.'},404)
    const resendKey=Deno.env.get('RESEND_API_KEY')||'',from=Deno.env.get('RESEND_FROM_EMAIL')||'';if(!resendKey||!from)return json({error:'E-mailová služba nie je nakonfigurovaná.'},503)
    let delivery='failed',providerId:string|null=null
    try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[item.email],reply_to:'vychodbrothers.spoluprace@gmail.com',subject,text:message})});const result=await response.json();if(!response.ok)throw new Error(`Resend ${response.status}`);delivery='sent';providerId=result.id||null}catch(error){console.error('Collaboration reply failed',error instanceof Error?error.message:'unknown')}
    await admin.from('collaboration_messages').insert({collaboration_id:id,direction:'outgoing',sender_email:from,recipient_email:item.email,subject,body:message,admin_user_id:auth.user!.id,delivery_status:delivery,provider_message_id:providerId})
    if(delivery!=='sent')return json({error:'Odpoveď sa nepodarilo odoslať.'},502)
    if(item.status==='new')await admin.from('collaboration_requests').update({status:'contacted'}).eq('id',id)
    await admin.from('admin_audit_logs').insert({admin_user_id:auth.user!.id,admin_email:auth.user!.email,action_type:'collaboration.reply',entity_type:'collaboration',entity_id:id,description:'Odoslaná odpoveď na spoluprácu',after_data:{recipient:item.email,subject}});return json({ok:true})
  }
  return json({error:'Neplatná operácia.'},400)
})
