import { corsHeaders, json } from '../_shared/http.ts'
import { createAdminClient } from '../_shared/supabase.ts'

const botPattern=/bot|crawler|spider|crawling|headless|lighthouse|pagespeed|monitor|uptime/i
const clean=(value:unknown,max:number)=>String(value||'').trim().slice(0,max)
const hash=async(value:string)=>{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes)).map((b)=>b.toString(16).padStart(2,'0')).join('')}
const source=(referrer:string)=>{if(!referrer)return'Direct';try{const host=new URL(referrer).hostname.toLowerCase();if(host.includes('google.'))return'Google';if(host.includes('youtube.')||host.includes('youtu.be'))return'YouTube';if(host.includes('facebook.')||host.includes('fb.'))return'Facebook';if(host.includes('instagram.'))return'Instagram';if(host.includes('tiktok.'))return'TikTok';return'Other'}catch{return'Direct'}}
const device=(ua:string)=>/ipad|tablet|kindle/i.test(ua)?'Tablet':/mobile|iphone|android/i.test(ua)?'Mobile':'Desktop'

Deno.serve(async(request)=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(request.method!=='POST')return json({error:'Method not allowed.'},405)
  const ua=request.headers.get('user-agent')||''
  if(botPattern.test(ua))return json({ok:true,ignored:true})
  let body:any;try{body=await request.json()}catch{return json({error:'Neplatná požiadavka.'},400)}
  const visitorId=clean(body.visitorId,80),sessionId=clean(body.sessionId,80),type=clean(body.type,20)
  let path=clean(body.path,300).split('?')[0].split('#')[0]||'/'
  if(!path.startsWith('/')||path.startsWith('/admin')||visitorId.length<16||sessionId.length<16||!['pageview','heartbeat'].includes(type))return json({ok:true,ignored:true})
  const [visitorHash,sessionHash]=await Promise.all([hash(visitorId),hash(sessionId)])
  const admin=createAdminClient(),now=new Date().toISOString()
  const presence=admin.from('analytics_presence').upsert({visitor_hash:visitorHash,path,last_seen:now},{onConflict:'visitor_hash'})
  if(type==='pageview'){
    const [{error:eventError},{error:presenceError}]=await Promise.all([admin.from('analytics_events').insert({visitor_hash:visitorHash,session_hash:sessionHash,path,source:source(clean(body.referrer,500)),device:device(ua)}),presence])
    if(eventError||presenceError)return json({error:'Analytický event sa nepodarilo uložiť.'},500)
  }else if((await presence).error)return json({error:'Presence sa nepodarilo aktualizovať.'},500)
  return json({ok:true})
})
