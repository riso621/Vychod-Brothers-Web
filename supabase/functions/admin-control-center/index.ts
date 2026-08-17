import { bearerToken, corsHeaders, json } from '../_shared/http.ts'
import { createAdminClient, createUserClient } from '../_shared/supabase.ts'
import { planForPrice, stripe } from '../_shared/stripe.ts'
import { deliverEmail } from '../_shared/club-emails.ts'

async function requireAdmin(request: Request) {
  const token = bearerToken(request)
  if (!token) return { error: json({ error: 'Prihlásenie je povinné.' }, 401) }
  const client = createUserClient(token)
  const { data: { user }, error } = await client.auth.getUser(token)
  if (error || !user) return { error: json({ error: 'Prihlásenie nie je platné.' }, 401) }
  if (user.app_metadata?.role !== 'admin') return { error: json({ error: 'Nemáte oprávnenie.' }, 403) }
  return { user }
}

const profileColumns = 'id,username,avatar_url,membership,membership_started_at,membership_expires_at,membership_status,stripe_customer_id,stripe_subscription_id,stripe_price_id,stripe_subscription_status,stripe_cancel_at_period_end,created_at'
const safeContentKeys = new Set(['brand.name','contact.email','support.email','homepage.hero.headline','homepage.hero.subtitle'])

function invoiceType(invoice: any) {
  if (invoice.status === 'void' || invoice.status === 'uncollectible') return 'failed'
  if (invoice.billing_reason === 'subscription_create') return 'initial'
  if (invoice.billing_reason === 'subscription_update') return 'upgrade'
  return 'renewal'
}

const invoiceMonthCache = new Map<string, { expiresAt:number, invoices:any[] }>()
const INVOICE_CACHE_MS = 60_000

function kickEmailDispatch(){
  const url=Deno.env.get('SUPABASE_URL')||'',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
  EdgeRuntime.waitUntil(fetch(`${url}/functions/v1/club-email-dispatch`,{method:'POST',headers:{Authorization:`Bearer ${key}`}}).catch((error)=>console.error('Email dispatch start failed',error instanceof Error?error.message:'unknown')))
}

function safeInvoice(invoice:any) {
  const pricedLines=(invoice.lines?.data||[]).filter((item:any)=>item.price?.id||item.pricing?.price_details?.price)
  const line=[...pricedLines].sort((a:any,b:any)=>(b.amount||0)-(a.amount||0)).find((item:any)=>planForPrice(item.price?.id||item.pricing?.price_details?.price||''))
  const priceId = line?.price?.id || line?.pricing?.price_details?.price || ''
  const period = line?.period || {}
  const paid=invoice.status==='paid'
  return {
    id:invoice.id, number:invoice.number, customer:typeof invoice.customer==='string'?invoice.customer:invoice.customer?.id,
    customerEmail:invoice.customer_email || invoice.customer_name || null, status:invoice.status, paid,
    amountPaid:invoice.amount_paid, amountDue:invoice.amount_due, total:invoice.total, currency:invoice.currency, created:invoice.created,
    type:invoiceType(invoice), plan:planForPrice(priceId), periodStart:period.start || invoice.period_start || null,
    periodEnd:period.end || invoice.period_end || null, invoicePdf:invoice.invoice_pdf || null,
    hostedInvoiceUrl:invoice.hosted_invoice_url || null,
  }
}

async function invoicesForMonth(year:number, month:number) {
  const key=`${year}-${month}`; const cached=invoiceMonthCache.get(key)
  if(cached && cached.expiresAt>Date.now()) return cached.invoices
  const start=Math.floor(Date.UTC(year,month-1,1)/1000), end=Math.floor(Date.UTC(year,month,1)/1000)
  const invoices:any[]=[]; let startingAfter:string|undefined
  for(let page=0;page<10;page+=1){
    const response=await stripe.invoices.list({created:{gte:start,lt:end},limit:100,starting_after:startingAfter})
    invoices.push(...response.data.map(safeInvoice))
    if(!response.has_more||!response.data.length)break
    startingAfter=response.data.at(-1)?.id
  }
  invoiceMonthCache.set(key,{expiresAt:Date.now()+INVOICE_CACHE_MS,invoices})
  if(invoiceMonthCache.size>12) invoiceMonthCache.delete(invoiceMonthCache.keys().next().value)
  return invoices
}

function invoiceSummary(invoices:any[]) {
  const currencies=[...new Set(invoices.map((i)=>i.currency).filter(Boolean))]
  const currency=currencies.length<=1?(currencies[0]||'eur'):null
  const paid=invoices.filter((i)=>i.status==='paid')
  const unpaid=invoices.filter((i)=>['open','uncollectible'].includes(i.status))
  return { count:invoices.length, currency,
    paidTotal:currency?paid.reduce((sum,i)=>sum+i.amountPaid,0):null,
    unpaidTotal:currency?unpaid.reduce((sum,i)=>sum+i.amountDue,0):null,
    memberRevenue:currency?paid.filter((i)=>i.plan==='member').reduce((sum,i)=>sum+i.amountPaid,0):null,
    vipRevenue:currency?paid.filter((i)=>i.plan==='vip').reduce((sum,i)=>sum+i.amountPaid,0):null,
    clubRevenue:currency?paid.filter((i)=>i.plan==='club').reduce((sum,i)=>sum+i.amountPaid,0):null }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const auth = await requireAdmin(request); if (auth.error) return auth.error
  let body: any; try { body = await request.json() } catch { return json({ error: 'Neplatná požiadavka.' }, 400) }
  const admin = createAdminClient()

  if (body.action === 'billing') {
    try {
      const now=new Date(), invoices=await invoicesForMonth(now.getUTCFullYear(),now.getUTCMonth()+1)
      return json({ invoices:invoices.slice(0,50).map((i)=>({id:i.id,customer:i.customer,status:i.status,paid:i.status==='paid',amount_paid:i.amountPaid,amount_due:i.amountDue,total:i.total,currency:i.currency,created:i.created,type:i.type,plan:i.plan})),summary:invoiceSummary(invoices) })
    } catch (error) {
      console.error('Admin billing query failed', error instanceof Error ? error.message : 'unknown')
      return json({ error:'Stripe faktúry sa nepodarilo načítať.' },502)
    }
  }
  if (body.action === 'invoices') {
    const year=Number(body.year),month=Number(body.month),limit=Math.min(50,Math.max(1,Number(body.limit)||25))
    const offset=/^\d+$/.test(String(body.cursor||'0'))?Number(body.cursor||0):0
    if(!Number.isInteger(year)||year<2020||year>new Date().getUTCFullYear()+1||!Number.isInteger(month)||month<1||month>12)return json({error:'Neplatné obdobie.'},400)
    try {
      const monthly=await invoicesForMonth(year,month), summary=invoiceSummary(monthly)
      const search=String(body.search||'').trim().toLowerCase(),plan=String(body.plan||'all'),status=String(body.status||'all')
      const filtered=monthly.filter((i)=> (plan==='all'||i.plan===plan)&&(status==='all'||i.status===status)&&(!search||`${i.number||''} ${i.customerEmail||''} ${i.id}`.toLowerCase().includes(search)))
      const page=filtered.slice(offset,offset+limit)
      return json({invoices:page,summary,total:filtered.length,nextCursor:offset+limit<filtered.length?String(offset+limit):null})
    } catch(error) {
      console.error('Admin invoice archive failed',error instanceof Error?error.message:'unknown')
      return json({error:'Stripe faktúry sa nepodarilo načítať.'},502)
    }
  }
  if (body.action === 'logs') {
    const { data,error } = await admin.from('admin_audit_logs').select('*').order('created_at',{ascending:false}).limit(200)
    return error ? json({error:'Audit log sa nepodarilo načítať.'},500) : json({logs:data||[]})
  }
  if (body.action === 'integrations') return json({ integrations:{ supabase:true,stripe:Boolean(Deno.env.get('STRIPE_SECRET_KEY')),cloudflare:Boolean(Deno.env.get('CLOUDFLARE_ACCOUNT_ID')&&Deno.env.get('CLOUDFLARE_STREAM_API_TOKEN')) } })

  if(body.action==='emails'){
    const {data,error}=await admin.from('email_deliveries').select('id,event_type,status,attempts,provider_message_id,created_at,sent_at,last_error,video_id').order('created_at',{ascending:false}).limit(100)
    if(error)return json({error:'E-mailový prehľad sa nepodarilo načítať.'},500)
    const rows=data||[]
    return json({deliveries:rows,summary:{sent:rows.filter((row)=>row.status==='sent').length,failed:rows.filter((row)=>row.status==='failed').length,pending:rows.filter((row)=>['pending','processing'].includes(row.status)).length,welcome:rows.filter((row)=>row.event_type==='membership_welcome').length,video:rows.filter((row)=>row.event_type==='video_published').length}})
  }
  if(body.action==='send-test-email'){
    const type=body.type==='new_video'?'new_video':body.type==='welcome'?'welcome':''
    const recipient=String(body.email||'').trim().toLowerCase()
    if(!type||!/^\S+@\S+\.\S+$/.test(recipient))return json({error:'Zadajte platný typ a testovací e-mail.'},400)
    let template:any={kind:'welcome'}
    let videoId:string|null=null
    if(type==='new_video'){
      const {data:video}=await admin.from('videos').select('id,title,slug,description,thumbnail_url').eq('published',true).in('access_level',['member','vip']).order('created_at',{ascending:false}).limit(1).maybeSingle()
      if(!video)return json({error:'Nie je dostupné publikované členské video pre test.'},400)
      videoId=video.id;const site=(Deno.env.get('SITE_URL')||'https://vychodbrothersclub.sk').replace(/\/$/,'')
      template={kind:'new_video',title:video.title,description:video.description,videoUrl:`${site}/videos/${encodeURIComponent(video.slug)}`,thumbnailUrl:video.thumbnail_url?`${Deno.env.get('SUPABASE_URL')}/functions/v1/club-email-thumbnail?video=${video.id}`:null}
    }
    const {data:delivery,error}=await admin.from('email_deliveries').insert({event_type:`test_${type}`,user_id:auth.user!.id,video_id:videoId,dedupe_key:`test:${type}:${auth.user!.id}:${crypto.randomUUID()}`,status:'processing',attempts:1}).select('id').single()
    if(error||!delivery)return json({error:'Testovací e-mail sa nepodarilo pripraviť.'},500)
    try{await deliverEmail(admin,delivery.id,recipient,template);await admin.from('admin_audit_logs').insert({admin_user_id:auth.user!.id,admin_email:auth.user!.email,action_type:'email.test_sent',entity_type:'email',entity_id:delivery.id,description:`Odoslaný testovací ${type} e-mail`,after_data:{type}});return json({ok:true})}
    catch(error){await admin.from('email_deliveries').update({status:'failed',last_error:error instanceof Error?error.message:'Delivery failed',updated_at:new Date().toISOString()}).eq('id',delivery.id);return json({error:'Testovací e-mail sa nepodarilo odoslať.'},502)}
  }

  if (body.action === 'social-stats') {
    const { data, error } = await admin.from('social_stats').select('platform,followers,synced_at,updated_at').order('platform')
    return error ? json({ error:'Sociálne štatistiky sa nepodarilo načítať.' },500) : json({ stats:data || [] })
  }

  if (body.action === 'save-social-stats') {
    const input = body.stats && typeof body.stats === 'object' ? body.stats : {}
    const allowed = ['youtube','instagram','tiktok']
    const rows = allowed.map((platform) => ({ platform, followers:Number(input[platform]) }))
    if (rows.some((row) => !Number.isSafeInteger(row.followers) || row.followers < 0)) return json({ error:'Zadajte celé nezáporné hodnoty pre všetky platformy.' },400)
    const { data: before, error: readError } = await admin.from('social_stats').select('platform,followers').in('platform',allowed)
    if (readError) return json({ error:'Aktuálne sociálne štatistiky sa nepodarilo načítať.' },500)
    const now = new Date().toISOString()
    const { error } = await admin.from('social_stats').upsert(rows.map((row) => ({ ...row, synced_at:now, updated_at:now, status:'ok', last_error:null })), { onConflict:'platform' })
    if (error) return json({ error:'Sociálne štatistiky sa nepodarilo uložiť.' },500)
    const beforeMap = new Map((before || []).map((row:any) => [row.platform,row.followers]))
    const changed = rows.filter((row) => beforeMap.get(row.platform) !== row.followers)
    await admin.from('admin_audit_logs').insert({ admin_user_id:auth.user!.id, admin_email:auth.user!.email, action_type:'social_stats.updated', entity_type:'social_stats', entity_id:'youtube,instagram,tiktok', description:`Aktualizované sociálne štatistiky: ${changed.map((row) => row.platform).join(', ') || 'bez zmeny'}`, before_data:Object.fromEntries(beforeMap), after_data:Object.fromEntries(rows.map((row) => [row.platform,row.followers])) })
    return json({ ok:true, updatedAt:now, changed:changed.map((row) => row.platform) })
  }

  if(body.action==='video-interaction-stats'){
    const {data,error}=await admin.from('video_interaction_stats').select('video_id,like_count,comment_count')
    return error?json({error:'Štatistiky interakcií sa nepodarilo načítať.'},500):json({stats:data||[]})
  }

  if(body.action==='video-comments'){
    const videoId=String(body.videoId||''),status=String(body.status||'all'),search=String(body.search||'').trim(),limit=Math.min(50,Math.max(1,Number(body.limit)||25)),offset=Math.max(0,Number(body.offset)||0)
    if(videoId&&!/^[0-9a-f-]{36}$/i.test(videoId))return json({error:'Neplatné video.'},400)
    if(!['all','visible','hidden','deleted'].includes(status))return json({error:'Neplatný filter.'},400)
    let query=admin.from('video_comments').select('id,video_id,user_id,body,status,created_at,updated_at,deleted_at,moderated_at,moderated_by',{count:'exact'}).order('created_at',{ascending:false}).range(offset,offset+limit-1)
    if(videoId)query=query.eq('video_id',videoId)
    if(status!=='all')query=query.eq('status',status)
    if(search)query=query.ilike('body',`%${search.replace(/[%_]/g,'')}%`)
    const {data:comments,count,error}=await query
    if(error)return json({error:'Komentáre sa nepodarilo načítať.'},500)
    const userIds=[...new Set((comments||[]).map((item:any)=>item.user_id))],videoIds=[...new Set((comments||[]).map((item:any)=>item.video_id))]
    const [{data:profiles},{data:videos}]=await Promise.all([userIds.length?admin.from('profiles').select('id,username').in('id',userIds):Promise.resolve({data:[]}),videoIds.length?admin.from('videos').select('id,title,slug').in('id',videoIds):Promise.resolve({data:[]})])
    const profileMap=new Map((profiles||[]).map((item:any)=>[item.id,item])),videoMap=new Map((videos||[]).map((item:any)=>[item.id,item]))
    return json({comments:(comments||[]).map((item:any)=>({...item,username:profileMap.get(item.user_id)?.username||'Člen komunity',videoTitle:videoMap.get(item.video_id)?.title||'Nedostupné',videoSlug:videoMap.get(item.video_id)?.slug||null})),total:count||0})
  }

  if(body.action==='moderate-video-comment'){
    const commentId=String(body.commentId||''),operation=String(body.operation||'')
    if(!/^[0-9a-f-]{36}$/i.test(commentId)||!['hide','restore','delete'].includes(operation))return json({error:'Neplatná moderácia.'},400)
    const {data:before}=await admin.from('video_comments').select('id,video_id,user_id,body,status,deleted_at').eq('id',commentId).maybeSingle()
    if(!before)return json({error:'Komentár sa nenašiel.'},404)
    const nextStatus=operation==='restore'?'visible':operation==='hide'?'hidden':'deleted',now=new Date().toISOString()
    const {error}=await admin.from('video_comments').update({status:nextStatus,deleted_at:nextStatus==='deleted'?now:null,moderated_at:now,moderated_by:auth.user!.id}).eq('id',commentId)
    if(error)return json({error:'Komentár sa nepodarilo moderovať.'},500)
    await admin.from('admin_audit_logs').insert({admin_user_id:auth.user!.id,admin_email:auth.user!.email,action_type:`video.comment.${operation}`,entity_type:'video_comment',entity_id:commentId,description:`Komentár ${operation} pri videu ${before.video_id}`,before_data:{status:before.status,deleted_at:before.deleted_at},after_data:{status:nextStatus,video_id:before.video_id,user_id:before.user_id}})
    return json({ok:true,status:nextStatus})
  }

  if (body.action === 'snapshot' || body.action === 'user-detail') {
    const { data: profiles, error } = await admin.from('profiles').select(profileColumns).order('created_at', { ascending: false })
    if (error) return json({ error: 'Profily sa nepodarilo načítať.' }, 500)
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const authMap = new Map((authData?.users || []).map((u) => [u.id, u]))
    const users = (profiles || []).map((p) => { const u = authMap.get(p.id); return { ...p, email:u?.email || null, email_confirmed_at:u?.email_confirmed_at || null, last_sign_in_at:u?.last_sign_in_at || null, banned_until:u?.banned_until || null } })
    if (body.action === 'user-detail') {
      const user = users.find((u) => u.id === body.userId); if (!user) return json({ error:'Používateľ sa nenašiel.' }, 404)
      const { data: history } = await admin.from('watch_history').select('video_id,position_seconds,duration_seconds,progress_percent,completed,last_watched_at').eq('user_id', user.id).order('last_watched_at',{ascending:false}).limit(20)
      const videoIds=[...new Set((history||[]).map((item:any)=>item.video_id))]
      const { data:historyVideos }=videoIds.length?await admin.from('videos').select('id,title,access_level').in('id',videoIds):{data:[]}
      const videoMap=new Map((historyVideos||[]).map((video:any)=>[video.id,video]))
      const watchHistory=(history||[]).map((item:any)=>({...item,title:videoMap.get(item.video_id)?.title||null,access_level:videoMap.get(item.video_id)?.access_level||null}))
      let invoices:any[] = [], subscription:any = null
      const stripeTasks:Promise<any>[]=[]
      if (user.stripe_customer_id) {
        stripeTasks.push(stripe.invoices.list({ customer:user.stripe_customer_id, limit:50 }).then((response)=>{invoices=response.data.map(safeInvoice)}))
      }
      if(user.stripe_subscription_id)stripeTasks.push(stripe.subscriptions.retrieve(user.stripe_subscription_id).then((value:any)=>{const item=value.items?.data?.[0],price=item?.price;subscription={id:value.id,status:value.status,priceId:price?.id||null,unitAmount:price?.unit_amount??null,currency:price?.currency||null,currentPeriodEnd:item?.current_period_end||null,cancelAtPeriodEnd:Boolean(value.cancel_at_period_end),cancelAt:value.cancel_at||null}}))
      try{await Promise.all(stripeTasks)}catch(error){console.error('Admin user Stripe detail failed',error instanceof Error?error.message:'unknown')}
      return json({ user, watchHistory, invoices, subscription })
    }
    const { data: videos } = await admin.from('videos').select('id,title,slug,provider,access_level,published,featured,thumbnail_url,created_at').order('created_at',{ascending:false})
    let invoices:any[] = []
    try { const response = await stripe.invoices.list({ limit:100 }); invoices = response.data.map((i:any) => ({ id:i.id,customer:typeof i.customer === 'string' ? i.customer : i.customer?.id,status:i.status,paid:i.paid,amount_paid:i.amount_paid,amount_due:i.amount_due,currency:i.currency,created:i.created,type:invoiceType(i),subscription_status:null })) } catch (error) { console.error('Admin Stripe invoice list failed', error instanceof Error ? error.message : 'unknown') }
    const { data: logs } = await admin.from('admin_audit_logs').select('*').order('created_at',{ascending:false}).limit(100)
    const { data: content } = await admin.from('site_content').select('key,value,description,updated_at').order('key')
    return json({ users, videos:videos || [], invoices, logs:logs || [], content:content || [], integrations: {
      supabase: true,
      stripe: Boolean(Deno.env.get('STRIPE_SECRET_KEY')),
      cloudflare: Boolean(Deno.env.get('CLOUDFLARE_ACCOUNT_ID') && Deno.env.get('CLOUDFLARE_STREAM_API_TOKEN')),
    } })
  }

  if (body.action === 'save-content') {
    const key = String(body.key || ''), value = body.value
    if (!safeContentKeys.has(key) || typeof value !== 'string' || value.trim().length < 2 || value.length > 500) return json({ error:'Neplatný obsah.' },400)
    const { data: before } = await admin.from('site_content').select('value').eq('key',key).maybeSingle()
    const { error } = await admin.from('site_content').upsert({ key, value:value.trim(), updated_by:auth.user!.id }, { onConflict:'key' })
    if (error) return json({ error:'Obsah sa nepodarilo uložiť.' },500)
    await admin.from('admin_audit_logs').insert({ admin_user_id:auth.user!.id, admin_email:auth.user!.email, action_type:'content.update', entity_type:'site_content', entity_id:key, description:`Aktualizovaný obsah ${key}`, before_data:before ? { value:before.value } : null, after_data:{ value:value.trim() } })
    return json({ ok:true })
  }

  if (body.action === 'video-toggle') {
    const field = body.field === 'published' ? 'published' : body.field === 'featured' ? 'featured' : ''
    if (!field || !/^[0-9a-f-]{36}$/i.test(String(body.videoId || '')) || typeof body.value !== 'boolean') return json({error:'Neplatná zmena videa.'},400)
    const { data:before } = await admin.from('videos').select('id,title,published,featured,access_level').eq('id',body.videoId).single()
    const { error } = await admin.from('videos').update({ [field]:body.value }).eq('id',body.videoId)
    if (error) return json({error:'Video sa nepodarilo zmeniť.'},500)
    await admin.from('admin_audit_logs').insert({ admin_user_id:auth.user!.id,admin_email:auth.user!.email,action_type:`video.${field}`,entity_type:'video',entity_id:body.videoId,description:`${field} zmenené pre ${before?.title || body.videoId}`,before_data:{[field]:before?.[field]},after_data:{[field]:body.value} })
    if(field==='published'&&body.value===true&&before?.published===false&&['member','vip'].includes(before.access_level)){
      const {data:campaign,error:queueError}=await admin.rpc('queue_member_video_email',{p_video_id:body.videoId})
      if(queueError)console.error('Video email queue failed',{code:queueError.code});else if(campaign)kickEmailDispatch()
    }
    return json({ok:true})
  }
  if (body.action === 'save-video') {
    const video = body.video || {}
    if (!video.title || !video.slug || !['free','member','vip'].includes(video.access_level) || !['youtube','stream','cloudflare_stream'].includes(video.provider)) return json({error:'Neplatné údaje videa.'},400)
    const id = String(body.videoId || '')
    if (id && !/^[0-9a-f-]{36}$/i.test(id)) return json({error:'Neplatný identifikátor videa.'},400)
    const providerVideoId = video.provider_video_id == null ? null : String(video.provider_video_id).trim()
    const trailerVideoId = video.trailer_provider_video_id == null ? null : String(video.trailer_provider_video_id).trim()
    if (video.provider === 'cloudflare_stream' && providerVideoId && !/^[a-zA-Z0-9]+$/.test(providerVideoId)) return json({error:'Hlavné video nemá platný Cloudflare identifikátor.'},400)
    if (trailerVideoId && !/^[a-zA-Z0-9]+$/.test(trailerVideoId)) return json({error:'Trailer nemá platný Cloudflare identifikátor.'},400)
    const safeVideo = {
      title: String(video.title).trim(), slug: String(video.slug).trim(),
      description: String(video.description || '').trim(), thumbnail_url: video.thumbnail_url || null,
      provider: video.provider, provider_video_id: providerVideoId,
      trailer_provider_video_id: trailerVideoId, access_level: video.access_level,
      published: Boolean(video.published), featured: Boolean(video.featured),
    }
    const { data:before } = id ? await admin.from('videos').select('id,title,slug,access_level,published,featured,provider').eq('id',id).maybeSingle() : { data:null }
    const query = id ? admin.from('videos').update(safeVideo).eq('id',id).select('id').single() : admin.from('videos').insert(safeVideo).select('id').single()
    const { data:saved,error } = await query
    if (error) {
      console.error('Admin video save failed', { code:error.code, id:id || 'new' })
      const errorMessage = error.code === '23505' ? 'Video s týmto slugom už existuje.' : error.code === '42501' ? 'Server nemá databázové oprávnenie uložiť video.' : 'Video sa nepodarilo uložiť.'
      return json({error:errorMessage,code:error.code || 'video_save_failed'},400)
    }
    await admin.from('admin_audit_logs').insert({admin_user_id:auth.user!.id,admin_email:auth.user!.email,action_type:id?'video.update':'video.create',entity_type:'video',entity_id:saved.id,description:`${id?'Upravené':'Vytvorené'} video ${safeVideo.title}`,before_data:before,after_data:{title:safeVideo.title,slug:safeVideo.slug,access_level:safeVideo.access_level,published:safeVideo.published,featured:safeVideo.featured,provider:safeVideo.provider,trailer:trailerVideoId?'stored':null}})
    if(safeVideo.published&&before?.published!==true&&['member','vip'].includes(safeVideo.access_level)){
      const {data:campaign,error:queueError}=await admin.rpc('queue_member_video_email',{p_video_id:saved.id})
      if(queueError)console.error('Video email queue failed',{code:queueError.code});else if(campaign)kickEmailDispatch()
    }
    return json({ok:true,id:saved.id})
  }
  return json({ error:'Neplatná operácia.' },400)
})
