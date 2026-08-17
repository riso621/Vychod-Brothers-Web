import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

type TemplateInput={kind:'welcome'|'new_video';name?:string|null;title?:string;description?:string;videoUrl?:string;thumbnailUrl?:string|null}

const esc=(value:string)=>value.replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;"}[char]!))
const excerpt=(value='')=>value.trim().replace(/\s+/g,' ').slice(0,220)

const socialLinks=[
  {label:'YouTube',short:'YT',url:'https://www.youtube.com/@Vychodbrothers1'},
  {label:'Instagram',short:'IG',url:'https://www.instagram.com/vychodbrothers/'},
  {label:'TikTok',short:'TT',url:'https://www.tiktok.com/@vychodbrothers'},
  {label:'Facebook',short:'FB',url:'https://www.facebook.com/riso.vanci/'},
]

const brandHeader=()=>`<tr><td class="pad-x" style="padding:28px 36px 20px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
    <td width="34%" style="border-top:1px solid #6f6b00;font-size:1px;line-height:1px">&nbsp;</td>
    <td align="center" style="padding:0 14px;color:#d7d7d0;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:4px;white-space:nowrap">VÝCHOD BROTHERS CLUB</td>
    <td width="34%" style="border-top:1px solid #6f6b00;font-size:1px;line-height:1px">&nbsp;</td>
  </tr></table>
  <div style="padding-top:15px;text-align:center;color:#f1e900;font-family:Arial Black,Arial,sans-serif;font-size:22px;font-weight:900;line-height:1">VB</div>
</td></tr>`

const cta=(url:string,label:string)=>`<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:0 0 8px">
  <table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#f1e900" style="border:1px solid #fff700;border-radius:7px;box-shadow:0 0 18px rgba(241,233,0,.16)">
    <a href="${esc(url)}" style="display:inline-block;min-width:260px;padding:18px 28px;color:#090a09;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:14px;font-weight:900;letter-spacing:1.2px;line-height:1.2;text-align:center;text-decoration:none">${label} &nbsp;→</a>
  </td></tr></table>
</td></tr></table>`

const socialRow=()=>`<table role="presentation" align="center" cellspacing="0" cellpadding="0"><tr>${socialLinks.map((item)=>`<td style="padding:0 7px"><a href="${item.url}" aria-label="${item.label}" style="display:block;width:42px;height:42px;border:1px solid #7d7800;border-radius:50%;color:#f5f4ed;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:900;line-height:42px;text-align:center;text-decoration:none">${item.short}</a></td>`).join('')}</tr></table>`

const footer=(site:string)=>`<tr><td class="pad-x" style="padding:28px 36px 34px;border-top:1px solid #242520;text-align:center">
  ${socialRow()}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:25px"><tr><td width="31%" style="border-top:1px solid #6f6b00;font-size:1px;line-height:1px">&nbsp;</td><td style="padding:0 12px;color:#999a92;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:3.6px;white-space:nowrap">VÝCHOD BROTHERS CLUB</td><td width="31%" style="border-top:1px solid #6f6b00;font-size:1px;line-height:1px">&nbsp;</td></tr></table>
  <p style="margin:18px 0 0;color:#777870;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.65">Tento e-mail posiela Východ Brothers Club.<br>Obsahové notifikácie bude možné spravovať v nastaveniach účtu.<br>Kritické transakčné správy zostávajú oddelené.</p>
  <p style="margin:12px 0 0"><a href="${esc(site)}/account" style="color:#dcd600;font-family:Arial,Helvetica,sans-serif;font-size:11px;text-decoration:underline">Môj účet a nastavenia</a></p>
</td></tr>`

const benefits=[
  ['▷','VŠETKY<br>ČLENSKÉ VIDEÁ','Exkluzívny obsah iba pre členov'],
  ['☆','ZÁKULISIE<br>A BONUSY','Obsah, ktorý na YouTube nenájdeš'],
  ['▣','NOVÉ VIDEÁ<br>SKÔR AKO OSTATNÍ','Členský obsah medzi prvými'],
  ['◎','KOMUNITA<br>A INTERAKCIE','Komentáre a Club interakcie'],
  ['◇','ŠPECIÁLNE<br>VÝHODY','Club výhody a budúce prekvapenia'],
]

const benefitsBlock=()=>`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #5e5b00;border-radius:9px;background:#0b0c0b"><tr><td class="benefit-wrap" style="padding:24px 16px 22px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td colspan="5" align="center" style="padding:0 0 20px;color:#f1e900;font-family:Arial Black,Arial,sans-serif;font-size:13px;font-weight:900;letter-spacing:2.5px">— &nbsp; ČO TERAZ ZÍSKAVAŠ &nbsp; —</td></tr><tr>
  ${benefits.map(([icon,title,copy],index)=>`<td class="benefit-cell" width="20%" valign="top" align="center" style="padding:0 7px;${index?'border-left:1px solid #292a26':''}"><div style="color:#f1e900;font-family:Arial,Helvetica,sans-serif;font-size:31px;line-height:1.1">${icon}</div><div style="margin-top:12px;color:#f5f4ed;font-family:Arial Narrow,Arial,Helvetica,sans-serif;font-size:11px;font-weight:900;line-height:1.3">${title}</div><div style="margin-top:8px;color:#a2a39b;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.45">${copy}</div></td>`).join('')}
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
  const responsive=`<style>@media only screen and (max-width:620px){.outer{padding:0!important}.shell{border-left:0!important;border-right:0!important}.pad-x{padding-left:22px!important;padding-right:22px!important}.hero-title{font-size:49px!important}.watermark{font-size:76px!important}.benefit-wrap{padding:22px 16px 10px!important}.benefit-cell{display:block!important;width:100%!important;box-sizing:border-box!important;border-left:0!important;border-top:1px solid #292a26!important;padding:14px 4px!important}.benefit-cell:first-child{border-top:0!important}.video-title{font-size:29px!important}.thank-title{font-size:25px!important}.mobile-full{width:100%!important}.mobile-full a{box-sizing:border-box!important;min-width:0!important;width:100%!important}.social-cell{padding-left:4px!important;padding-right:4px!important}}</style>`
  const welcomeContent=`
    <tr><td class="pad-x" style="padding:18px 36px 24px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td valign="top"><div style="color:#f1e900;font-family:Arial Black,Arial,sans-serif;font-size:29px;font-weight:900;line-height:1">VB <span style="color:#f4f3ed;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:3px">VÝCHOD<br>BROTHERS</span></div></td><td class="watermark" align="right" valign="middle" style="color:#171810;font-family:Arial Black,Arial,sans-serif;font-size:104px;font-weight:900;line-height:.75">VB</td></tr></table>
      <h1 class="hero-title" style="margin:18px 0 0;color:#f5f4ed;font-family:Arial Black,Arial Narrow,Arial,sans-serif;font-size:66px;font-weight:900;letter-spacing:-3px;line-height:.88">VITAJ<br><span style="color:#f1e900">V CLUBE.</span></h1>
      <div style="width:190px;height:4px;margin:20px 0 34px;background:#f1e900"></div>
      <p style="margin:0 0 20px;color:#f4f3ed;font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;line-height:1.5">${greeting}</p>
      <p style="margin:0 0 30px;color:#c7c7c0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75">Tvoje členstvo je aktívne.<br>Od tejto chvíle máš prístup ku všetkému <span style="color:#f1e900;font-weight:700">členskému obsahu</span> Východ Brothers.</p>
      ${benefitsBlock()}
    </td></tr>
    <tr><td class="pad-x" style="padding:0 36px 34px">${cta(ctaUrl,'POZRIEŤ ČLENSKÉ VIDEÁ')}</td></tr>
    <tr><td class="pad-x" style="padding:0 36px 36px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #30312d;border-radius:9px;background:#0a0b0a"><tr><td align="center" style="padding:34px 24px">
      <div class="thank-title" style="color:#f1e900;font-family:'Segoe Print','Bradley Hand',cursive;font-size:31px;font-style:italic;line-height:1.3">Ďakujeme, že si v tom s nami!</div>
      <div style="width:75%;height:1px;margin:13px auto 22px;background:#726e00"></div>
      <p style="margin:0;color:#d0d0c9;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7">Práve vďaka ľuďom ako ty môžeme robiť viac videí,<br>väčšie projekty a obsah, ktorý by na YouTube nevznikol.</p>
      <div style="margin:20px 0 14px;color:#f1e900;font-family:Georgia,serif;font-size:31px;line-height:1">♡</div>
      <div style="color:#f5f4ed;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:800">Východ Brothers</div>
      <div style="margin-top:8px;color:#f1e900;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:4px">DAVID &nbsp;•&nbsp; IVAN &nbsp;•&nbsp; RIŠO</div>
    </td></tr></table></td></tr>`
  const safeTitle=esc(input.title||'Nové členské video')
  const description=excerpt(input.description)
  const newVideoContent=`
    <tr><td class="pad-x" style="padding:24px 36px 14px"><div style="color:#f1e900;font-family:Arial Black,Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:2.4px">NOVÉ V CLUBE</div><h1 class="hero-title" style="margin:13px 0 0;color:#f5f4ed;font-family:Arial Black,Arial Narrow,Arial,sans-serif;font-size:52px;font-weight:900;letter-spacing:-2px;line-height:.92">NOVÉ VIDEO<br><span style="color:#f1e900">PRÁVE PRISTÁLO.</span></h1><div style="width:150px;height:3px;margin:19px 0 0;background:#f1e900"></div></td></tr>
    <tr><td class="pad-x" style="padding:22px 36px 36px">
      ${input.thumbnailUrl?`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #4b4900;border-radius:8px"><tr><td><img src="${esc(input.thumbnailUrl)}" width="596" alt="${safeTitle}" style="display:block;width:100%;height:auto;border:0;border-radius:7px"></td></tr></table>`:'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #34352f;background:#111210"><tr><td align="center" style="padding:58px 20px;color:#f1e900;font-family:Arial Black,Arial,sans-serif;font-size:38px">VB</td></tr></table>'}
      <div style="margin-top:24px;color:#f1e900;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:800;letter-spacing:2.2px">ORIGINÁLNA TVORBA • BONUSY • PREMIÉRY</div>
      <h2 class="video-title" style="margin:10px 0 0;color:#f5f4ed;font-family:Arial Black,Arial Narrow,Arial,sans-serif;font-size:34px;font-weight:900;line-height:1.08">${safeTitle}</h2>
      ${description?`<p style="margin:14px 0 0;color:#b9bab2;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7">${esc(description)}</p>`:''}
      <div style="padding-top:28px">${cta(ctaUrl,'POZRIEŤ VIDEO')}</div>
    </td></tr>`
  const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">${responsive}</head><body style="margin:0;padding:0;background:#050605;color:#f6f5ef"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preview)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050605"><tr><td class="outer" align="center" style="padding:24px 10px"><table role="presentation" class="shell" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;border:1px solid #292a25;background:#090a09">${brandHeader()}${isWelcome?welcomeContent:newVideoContent}${footer(site)}</table></td></tr></table></body></html>`
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
