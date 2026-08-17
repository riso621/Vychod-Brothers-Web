import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

type TemplateInput={kind:'welcome'|'new_video';name?:string|null;title?:string;description?:string;videoUrl?:string;thumbnailUrl?:string|null}

const esc=(value:string)=>value.replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;"}[char]!))
const excerpt=(value='')=>value.trim().replace(/\s+/g,' ').slice(0,220)
const visibleEmailText=(html:string)=>html.replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim()
const welcomeThankYou='Ďakujeme, že si v tom s nami!'
const forbiddenWelcomeCopy=['Ďakujeme, že sí v tom s nami!','Ďakujeme, že si v tom s namí!','Ďakujeme, že sí v tom s namí!']

export function assertWelcomeEmailCopy(html:string){
  const text=visibleEmailText(html)
  const headline=html.match(/<div class="thank-title"[^>]*>([^<]*)<\/div>/)?.[1]
  if(headline!==welcomeThankYou||!text.includes(welcomeThankYou)||forbiddenWelcomeCopy.some((copy)=>text.includes(copy)))throw new Error('Welcome email copy validation failed')
}

const socialLinks=[
  {label:'YouTube',short:'YT',url:'https://www.youtube.com/@Vychodbrothers1'},
  {label:'Instagram',short:'IG',url:'https://www.instagram.com/vychodbrothers/'},
  {label:'TikTok',short:'TT',url:'https://www.tiktok.com/@vychodbrothers'},
  {label:'Facebook',short:'FB',url:'https://www.facebook.com/riso.vanci/'},
]

const brandHeader=()=>`<tr><td class="pad-x" style="padding:19px 34px 13px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
    <td width="34%" style="border-top:1px solid #6f6b00;font-size:1px;line-height:1px">&nbsp;</td>
    <td align="center" style="padding:0 12px;color:#d7d7d0;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;letter-spacing:3.2px;white-space:nowrap">VÝCHOD BROTHERS CLUB</td>
    <td width="34%" style="border-top:1px solid #6f6b00;font-size:1px;line-height:1px">&nbsp;</td>
  </tr></table>
  <div style="padding-top:10px;text-align:center;color:#f1e900;font-family:Arial Black,Arial,sans-serif;font-size:18px;font-weight:900;line-height:1">VB</div>
</td></tr>`

const cta=(url:string,label:string)=>`<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:0 0 8px">
  <table role="presentation" class="cta-table" cellspacing="0" cellpadding="0"><tr><td bgcolor="#f1e900" style="border:1px solid #fff700;border-radius:7px;box-shadow:0 0 18px rgba(241,233,0,.16)">
    <a href="${esc(url)}" style="display:inline-block;min-width:240px;padding:15px 25px;color:#090a09;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:13px;font-weight:900;letter-spacing:1.1px;line-height:1.2;text-align:center;text-decoration:none">${label} &nbsp;→</a>
  </td></tr></table>
</td></tr></table>`

const socialRow=()=>`<table role="presentation" align="center" cellspacing="0" cellpadding="0"><tr>${socialLinks.map((item)=>`<td style="padding:0 5px"><a href="${item.url}" aria-label="${item.label}" style="display:block;width:32px;height:32px;border:1px solid #666300;border-radius:50%;color:#e6e5de;font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:900;line-height:32px;text-align:center;text-decoration:none">${item.short}</a></td>`).join('')}</tr></table>`

const footer=(site:string)=>`<tr><td class="pad-x" style="padding:19px 34px 22px;border-top:1px solid #242520;text-align:center">
  ${socialRow()}
  <div style="margin-top:15px;color:#999a92;font-family:Arial,Helvetica,sans-serif;font-size:8px;letter-spacing:3px">VÝCHOD BROTHERS CLUB</div>
  <p style="margin:10px 0 0;color:#74756e;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.5">Tento e-mail posiela Východ Brothers Club.<br>Obsahové notifikácie spravuješ v nastaveniach účtu.</p>
  <p style="margin:8px 0 0"><a href="${esc(site)}/account" style="color:#dcd600;font-family:Arial,Helvetica,sans-serif;font-size:10px;text-decoration:underline">Môj účet a nastavenia</a></p>
</td></tr>`

const benefits=[
  ['▷','VŠETKY ČLENSKÉ VIDEÁ','Exkluzívny obsah iba pre členov'],
  ['☆','ZÁKULISIE A BONUSY','Obsah, ktorý na YouTube nenájdeš'],
  ['▣','NOVÝ OBSAH MEDZI PRVÝMI','Bonusy a členské premiéry'],
]

const benefitsBlock=()=>`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #5e5b00;border-radius:8px;background:#0b0c0b"><tr><td class="benefit-wrap" style="padding:18px 14px 16px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td colspan="3" align="center" style="padding:0 0 14px;color:#f1e900;font-family:Arial Black,Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:2px">— &nbsp; ČO TERAZ ZÍSKAVAŠ &nbsp; —</td></tr><tr>
  ${benefits.map(([icon,title,copy],index)=>`<td class="benefit-cell" width="33.33%" valign="top" align="center" style="padding:0 8px;${index?'border-left:1px solid #292a26':''}"><div style="color:#f1e900;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1">${icon}</div><div style="margin-top:8px;color:#f5f4ed;font-family:Arial Narrow,Arial,Helvetica,sans-serif;font-size:10px;font-weight:900;line-height:1.25">${title}</div><div class="benefit-copy" style="margin-top:5px;color:#95968e;font-family:Arial,Helvetica,sans-serif;font-size:9px;line-height:1.35">${copy}</div></td>`).join('')}
  </tr></table>
</td></tr></table>`

export function renderClubEmail(input:TemplateInput){
  const site=(Deno.env.get('SITE_URL')||'https://vychodbrothersclub.sk').replace(/\/$/,'')
  const isWelcome=input.kind==='welcome'
  const subject=isWelcome?'Vitaj vo Východ Brothers Clube':`NOVÉ V CLUBE: ${input.title||'Východ Brothers Club'}`
  const preview=isWelcome?'Tvoje členstvo je aktívne. Vitaj medzi nami.':'Nové členské video práve pristálo vo Východ Brothers Clube.'
  const ctaUrl=input.videoUrl||`${site}/videos`
  const cleanedName=input.name?.trim()
  const hasNaturalName=Boolean(cleanedName&&!/^člen$/i.test(cleanedName))
  const greeting=hasNaturalName?`Ahoj, <span style="color:#f1e900">${esc(cleanedName!)}</span>.`:'Vitaj medzi nami.'
  const responsive=`<style>@media only screen and (max-width:620px){.outer{padding:0!important}.shell{border-left:0!important;border-right:0!important}.pad-x{padding-left:20px!important;padding-right:20px!important}.hero-title{font-size:43px!important;letter-spacing:-2px!important}.watermark{font-size:62px!important}.benefit-wrap{padding:15px 10px 13px!important}.benefit-cell{padding-left:5px!important;padding-right:5px!important}.benefit-copy{display:none!important}.video-title{font-size:27px!important}.thank-title{font-size:21px!important}.cta-table{width:100%!important}.cta-table a{box-sizing:border-box!important;min-width:0!important;width:100%!important}}</style>`
  const welcomeContent=`
    <tr><td class="pad-x" style="padding:10px 34px 18px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td valign="middle"><h1 class="hero-title" style="margin:0;color:#f5f4ed;font-family:Arial Black,Arial Narrow,Arial,sans-serif;font-size:56px;font-weight:900;letter-spacing:-2.5px;line-height:.86">VITAJ<br><span style="color:#f1e900">V CLUBE.</span></h1></td><td class="watermark" width="30%" align="right" valign="middle" style="color:#11120d;font-family:Arial Black,Arial,sans-serif;font-size:76px;font-weight:900;line-height:.72">VB</td></tr></table>
      <div style="width:145px;height:3px;margin:15px 0 22px;background:#f1e900"></div>
      <p style="margin:0 0 11px;color:#f4f3ed;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;line-height:1.4">${greeting}</p>
      <p style="margin:0 0 19px;color:#c7c7c0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6">Tvoje členstvo je aktívne. Od tejto chvíle máš prístup ku všetkému <span style="color:#f1e900;font-weight:700">členskému obsahu</span> Východ Brothers.</p>
      ${benefitsBlock()}
    </td></tr>
    <tr><td class="pad-x" style="padding:0 34px 22px">${cta(ctaUrl,'POZRIEŤ ČLENSKÉ VIDEÁ')}</td></tr>
    <tr><td class="pad-x" style="padding:0 34px 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #30312d;border-radius:8px;background:#0a0b0a"><tr><td align="center" style="padding:22px 18px">
      <div class="thank-title" style="color:#f1e900;font-family:'Comic Sans MS','Segoe Print',cursive;font-size:25px;font-style:normal;font-weight:700;line-height:1.25">${welcomeThankYou}</div>
      <div style="width:65%;height:1px;margin:9px auto 13px;background:#726e00"></div>
      <p style="margin:0;color:#c5c6be;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55">Vďaka ľuďom ako ty môžeme robiť viac videí, väčšie projekty<br>a obsah, ktorý by na YouTube nevznikol.</p>
      <div style="margin:12px 0 7px;color:#f1e900;font-family:Georgia,serif;font-size:23px;line-height:1">♡</div>
      <div style="color:#f5f4ed;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800">Východ Brothers</div>
      <div style="margin-top:5px;color:#f1e900;font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:700;letter-spacing:3px">DAVID &nbsp;•&nbsp; IVAN &nbsp;•&nbsp; RIŠO</div>
    </td></tr></table></td></tr>`
  const safeTitle=esc(input.title||'Nové členské video')
  const description=excerpt(input.description)
  const newVideoContent=`
    <tr><td class="pad-x" style="padding:16px 34px 8px"><div style="color:#f1e900;font-family:Arial Black,Arial,sans-serif;font-size:10px;font-weight:900;letter-spacing:2.2px">NOVÉ V CLUBE</div><h1 class="hero-title" style="margin:10px 0 0;color:#f5f4ed;font-family:Arial Black,Arial Narrow,Arial,sans-serif;font-size:45px;font-weight:900;letter-spacing:-2px;line-height:.9">NOVÉ VIDEO<br><span style="color:#f1e900">PRÁVE PRISTÁLO.</span></h1><div style="width:120px;height:3px;margin:14px 0 0;background:#f1e900"></div></td></tr>
    <tr><td class="pad-x" style="padding:16px 34px 25px">
      ${input.thumbnailUrl?`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #4b4900;border-radius:8px"><tr><td><img src="${esc(input.thumbnailUrl)}" width="596" alt="${safeTitle}" style="display:block;width:100%;height:auto;border:0;border-radius:7px"></td></tr></table>`:'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #34352f;background:#111210"><tr><td align="center" style="padding:58px 20px;color:#f1e900;font-family:Arial Black,Arial,sans-serif;font-size:38px">VB</td></tr></table>'}
      <div style="margin-top:18px;color:#f1e900;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:800;letter-spacing:2px">ORIGINÁLNA TVORBA • BONUSY • PREMIÉRY</div>
      <h2 class="video-title" style="margin:8px 0 0;color:#f5f4ed;font-family:Arial Black,Arial Narrow,Arial,sans-serif;font-size:31px;font-weight:900;line-height:1.06">${safeTitle}</h2>
      ${description?`<p style="margin:10px 0 0;color:#b9bab2;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55">${esc(description)}</p>`:''}
      <div style="padding-top:20px">${cta(ctaUrl,'POZRIEŤ VIDEO')}</div>
    </td></tr>`
  const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">${responsive}</head><body style="margin:0;padding:0;background:#050605;color:#f6f5ef"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preview)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050605"><tr><td class="outer" align="center" style="padding:24px 10px"><table role="presentation" class="shell" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;border:1px solid #292a25;background:#090a09">${brandHeader()}${isWelcome?welcomeContent:newVideoContent}${footer(site)}</table></td></tr></table></body></html>`
  if(isWelcome)assertWelcomeEmailCopy(html)
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
