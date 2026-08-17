import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

type TemplateInput={kind:'welcome'|'new_video';name?:string|null;title?:string;description?:string;videoUrl?:string;thumbnailUrl?:string|null}

const esc=(value:string)=>value.replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;"}[char]!))
const excerpt=(value='')=>value.trim().replace(/\s+/g,' ').slice(0,220)

export function renderClubEmail(input:TemplateInput){
  const site=(Deno.env.get('SITE_URL')||'https://vychodbrothersclub.sk').replace(/\/$/,'')
  const isWelcome=input.kind==='welcome'
  const subject=isWelcome?'Vitaj vo Východ Brothers Clube':`NOVÉ VIDEO: ${input.title||'Východ Brothers Club'}`
  const preview=isWelcome?'Tvoje členstvo je aktívne. Vitaj medzi nami.':'Nové členské video práve pristálo vo Východ Brothers Clube.'
  const ctaUrl=input.videoUrl||`${site}/videos`
  const greeting=input.name?`<p style="margin:0 0 18px;color:#f4f3ed;font-size:17px;line-height:1.6">Ahoj, <strong>${esc(input.name)}</strong>.</p>`:''
  const hero=isWelcome?'VITAJ<br>V CLUBE.':'NOVÉ VIDEO<br>PRÁVE PRISTÁLO.'
  const body=isWelcome
    ? `${greeting}<p style="margin:0;color:#b7b7b0;font-size:16px;line-height:1.7">Tvoje členstvo je aktívne. Od tejto chvíle máš prístup ku všetkému členskému obsahu Východ Brothers.</p><div style="margin:28px 0;padding:22px;border:1px solid #30312d;background:#111210"><div style="margin-bottom:14px;color:#e6df00;font-size:12px;font-weight:800;letter-spacing:1.5px">ČO TERAZ ZÍSKAVAŠ</div><div style="color:#f4f3ed;font-size:15px;line-height:2">✓ Všetky členské videá<br>✓ Zákulisie a bonusový obsah<br>✓ Budúci členský obsah<br>✓ Komentáre a komunitné interakcie</div></div>`
    : `${input.thumbnailUrl?`<img src="${esc(input.thumbnailUrl)}" width="600" alt="${esc(input.title||'Nové video')}" style="display:block;width:100%;height:auto;border:0;border-radius:8px;margin:0 0 26px">`:''}<div style="color:#e6df00;font-size:12px;font-weight:800;letter-spacing:1.5px;margin-bottom:10px">NOVÉ V CLUBE</div><h2 style="margin:0 0 12px;color:#f6f5ef;font-size:25px;line-height:1.2">${esc(input.title||'Nové členské video')}</h2>${excerpt(input.description)?`<p style="margin:0;color:#b7b7b0;font-size:16px;line-height:1.7">${esc(excerpt(input.description))}</p>`:''}`
  const thanks=isWelcome?'<p style="margin:30px 0 0;color:#aaa99f;font-size:14px;line-height:1.7">Ďakujeme, že nás podporuješ. Vďaka ľuďom ako ty môžeme robiť viac videí, väčšie projekty a obsah, ktorý by na YouTube nevznikol.</p><p style="margin:18px 0 0;color:#f4f3ed;font-size:14px"><strong>Východ Brothers</strong><br><span style="color:#8d8d86">David • Ivan • Rišo</span></p>':''
  const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head><body style="margin:0;background:#070807;color:#f6f5ef;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${esc(preview)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070807"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#0c0d0c;border:1px solid #2d2e29"><tr><td style="padding:24px 30px;border-bottom:1px solid #242520"><table role="presentation" width="100%"><tr><td style="color:#e6df00;font-size:25px;font-weight:900">VB</td><td align="right" style="color:#c7c7bf;font-size:11px;font-weight:800;letter-spacing:1.7px">VÝCHOD BROTHERS CLUB</td></tr></table></td></tr><tr><td style="padding:42px 30px 22px"><div style="color:#e6df00;font-size:11px;font-weight:800;letter-spacing:1.8px;margin-bottom:14px">${isWelcome?'ČLENSTVO AKTÍVNE':'ORIGINÁLNA TVORBA • BONUSY • PREMIÉRY'}</div><h1 style="margin:0;color:#f6f5ef;font-size:42px;line-height:.98;letter-spacing:-1px">${hero}</h1></td></tr><tr><td style="padding:8px 30px 38px">${body}<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:28px"><tr><td bgcolor="#e6df00" style="border-radius:7px"><a href="${esc(ctaUrl)}" style="display:inline-block;padding:16px 24px;color:#090a09;text-decoration:none;font-size:13px;font-weight:900;letter-spacing:.8px">${isWelcome?'POZRIEŤ ČLENSKÉ VIDEÁ':'POZRIEŤ VIDEO'} →</a></td></tr></table>${thanks}</td></tr><tr><td style="padding:24px 30px;border-top:1px solid #242520;color:#777870;font-size:11px;line-height:1.7">Tento e-mail posiela Východ Brothers Club. Obsahové notifikácie bude možné spravovať v nastaveniach účtu. Kritické transakčné správy zostávajú oddelené.<br><a href="${site}/account" style="color:#b6b6ae">Môj účet a nastavenia</a></td></tr></table></td></tr></table></body></html>`
  const text=isWelcome?`VITAJ V CLUBE.\n\nTvoje členstvo je aktívne. Od tejto chvíle máš prístup ku všetkému členskému obsahu Východ Brothers.\n\nPozrieť členské videá: ${ctaUrl}\n\nĎakujeme, že nás podporuješ.\nVýchod Brothers`
    :`NOVÉ VIDEO PRÁVE PRISTÁLO.\n\n${input.title||'Nové členské video'}\n${excerpt(input.description)}\n\nPozrieť video: ${ctaUrl}`
  return {subject,preview,html,text}
}

export async function deliverEmail(admin:SupabaseClient,deliveryId:string,to:string,input:TemplateInput){
  const key=Deno.env.get('RESEND_API_KEY')||'',from=Deno.env.get('RESEND_FROM_EMAIL')||''
  if(!key||!from)throw new Error('Email provider is not configured')
  const template=renderClubEmail(input)
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject:template.subject,html:template.html,text:template.text})})
  const result=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(`Resend delivery failed (${response.status})`)
  await admin.from('email_deliveries').update({status:'sent',provider_message_id:result.id||null,sent_at:new Date().toISOString(),updated_at:new Date().toISOString(),last_error:null}).eq('id',deliveryId)
  return result.id||null
}

export async function sendWelcomeOnce(admin:SupabaseClient,userId:string,subscriptionId:string){
  const dedupe=`welcome:${subscriptionId}`
  const {data:delivery,error}=await admin.from('email_deliveries').insert({event_type:'membership_welcome',user_id:userId,dedupe_key:dedupe,status:'processing',attempts:1}).select('id').single()
  if(error?.code==='23505')return {duplicate:true}
  if(error||!delivery)throw error||new Error('Delivery reservation failed')
  try{
    const [{data:{user}},{data:profile}]=await Promise.all([admin.auth.admin.getUserById(userId),admin.from('profiles').select('username').eq('id',userId).maybeSingle()])
    if(!user?.email)throw new Error('Recipient email is unavailable')
    await deliverEmail(admin,delivery.id,user.email,{kind:'welcome',name:profile?.username})
    return {sent:true}
  }catch(error){await admin.from('email_deliveries').update({status:'failed',last_error:error instanceof Error?error.message:'Delivery failed',updated_at:new Date().toISOString()}).eq('id',delivery.id);throw error}
}
