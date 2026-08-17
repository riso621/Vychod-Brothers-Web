import { json } from '../_shared/http.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { deliverEmail } from '../_shared/club-emails.ts'

const BATCH=25
async function processBatch(){
  const admin=createAdminClient()
  const {data:rows,error}=await admin.from('email_deliveries').select('id,campaign_id,user_id,video_id,attempts').eq('event_type','video_published').in('status',['pending','failed']).lt('attempts',3).order('created_at').limit(BATCH)
  if(error)throw error
  for(const row of rows||[]){
    const claimed=await admin.from('email_deliveries').update({status:'processing',attempts:(row.attempts||0)+1,updated_at:new Date().toISOString()}).eq('id',row.id).in('status',['pending','failed']).select('id').maybeSingle()
    if(!claimed.data)continue
    try{
      const [{data:{user}},{data:video}]=await Promise.all([admin.auth.admin.getUserById(row.user_id),admin.from('videos').select('title,slug,description,thumbnail_url,published').eq('id',row.video_id).maybeSingle()])
      if(!user?.email||!video?.published)throw new Error('Recipient or published video is unavailable')
      const site=(Deno.env.get('SITE_URL')||'https://vychodbrothersclub.sk').replace(/\/$/,'')
      const thumb=`${Deno.env.get('SUPABASE_URL')}/functions/v1/club-email-thumbnail?video=${encodeURIComponent(row.video_id)}`
      await deliverEmail(admin,row.id,user.email,{kind:'new_video',title:video.title,description:video.description,videoUrl:`${site}/videos/${encodeURIComponent(video.slug)}`,thumbnailUrl:video.thumbnail_url?thumb:null})
    }catch(error){await admin.from('email_deliveries').update({status:'failed',last_error:error instanceof Error?error.message:'Delivery failed',updated_at:new Date().toISOString()}).eq('id',row.id)}
  }
  const {count}=await admin.from('email_deliveries').select('id',{count:'exact',head:true}).eq('event_type','video_published').in('status',['pending','failed']).lt('attempts',3)
  if((count||0)>0){const url=Deno.env.get('SUPABASE_URL')||'',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';await fetch(`${url}/functions/v1/club-email-dispatch`,{method:'POST',headers:{Authorization:`Bearer ${key}`}})}
  const campaignIds=[...new Set((rows||[]).map((row:any)=>row.campaign_id).filter(Boolean))]
  for(const id of campaignIds){const {count:remaining}=await admin.from('email_deliveries').select('id',{count:'exact',head:true}).eq('campaign_id',id).neq('status','sent');if(!remaining)await admin.from('email_campaigns').update({status:'completed',completed_at:new Date().toISOString()}).eq('id',id)}
}

Deno.serve(async(request)=>{
  if(request.method!=='POST')return json({error:'Method not allowed.'},405)
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
  if(request.headers.get('authorization')!==`Bearer ${service}`)return json({error:'Nemáte oprávnenie.'},403)
  EdgeRuntime.waitUntil(processBatch().catch((error)=>console.error('Email dispatch failed',error instanceof Error?error.message:'unknown')))
  return json({accepted:true},202)
})
