import { corsHeaders, json } from '../_shared/http.ts'
import { createAdminClient } from '../_shared/supabase.ts'

const inbox='vychodbrothers.spoluprace@gmail.com'
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
const clean=(value:unknown,max:number)=>String(value||'').trim().slice(0,max)
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]!))

async function sourceHash(request:Request){const source=`${request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown'}|${request.headers.get('user-agent')||''}`;const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));return Array.from(new Uint8Array(digest)).map((byte)=>byte.toString(16).padStart(2,'0')).join('')}

Deno.serve(async(request)=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(request.method!=='POST')return json({error:'Method not allowed.'},405)
  let body:any;try{body=await request.json()}catch{return json({error:'Neplatná požiadavka.'},400)}
  if(clean(body.website,200))return json({ok:true})
  const payload={name:clean(body.name,120),company:clean(body.company,160)||null,email:clean(body.email,254).toLowerCase(),phone:clean(body.phone,40)||null,subject:clean(body.subject,180),message:clean(body.message,5000),budget:clean(body.budget,120)||null}
  if(payload.name.length<2||!emailPattern.test(payload.email)||payload.subject.length<2||payload.message.length<10)return json({error:'Skontrolujte povinné údaje formulára.'},400)
  const admin=createAdminClient(),hash=await sourceHash(request),since=new Date(Date.now()-15*60_000).toISOString()
  const {count}=await admin.from('collaboration_requests').select('id',{count:'exact',head:true}).eq('source_hash',hash).gte('created_at',since)
  if((count||0)>=3)return json({error:'Príliš veľa pokusov. Skúste to neskôr.'},429)
  const {data:created,error}=await admin.from('collaboration_requests').insert({...payload,source_hash:hash}).select('id,created_at').single()
  if(error)return json({error:'Ponuku sa nepodarilo odoslať. Skúste to neskôr.'},500)
  const {data:message,error:messageError}=await admin.from('collaboration_messages').insert({collaboration_id:created.id,direction:'incoming',sender_email:payload.email,recipient_email:inbox,subject:payload.subject,body:payload.message,delivery_status:'stored'}).select('id').single()
  if(messageError)return json({error:'Ponuka bola prijatá, ale históriu sa nepodarilo uložiť.'},500)
  const resendKey=Deno.env.get('RESEND_API_KEY')||'',from=Deno.env.get('RESEND_FROM_EMAIL')||''
  let notificationSent=false,providerMessageId:string|null=null
  if(resendKey&&from){
    try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[inbox],reply_to:payload.email,subject:`Nová spolupráca: ${payload.subject}`,html:`<h2>Nová ponuka na spoluprácu</h2><p><strong>${escapeHtml(payload.name)}</strong>${payload.company?` · ${escapeHtml(payload.company)}`:''}</p><p>${escapeHtml(payload.email)}</p><p>${escapeHtml(payload.message).replace(/\n/g,'<br>')}</p><p><a href="${escapeHtml((Deno.env.get('SITE_URL')||'').replace(/\/$/,'')+`/admin/collaborations/${created.id}`)}">Otvoriť v adminovi</a></p>`})});const result=await response.json();if(!response.ok)console.error('Collaboration notification failed',response.status);else{notificationSent=true;providerMessageId=result.id||null}}catch(error){console.error('Collaboration notification failed',error instanceof Error?error.message:'unknown')}
  }
  await admin.from('collaboration_messages').update({delivery_status:notificationSent?'sent':'failed',provider_message_id:providerMessageId}).eq('id',message.id)
  return json({ok:true,id:created.id,notificationSent})
})
