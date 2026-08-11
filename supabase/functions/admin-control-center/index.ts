import { bearerToken, corsHeaders, json } from '../_shared/http.ts'
import { createAdminClient, createUserClient } from '../_shared/supabase.ts'
import { stripe } from '../_shared/stripe.ts'

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const auth = await requireAdmin(request); if (auth.error) return auth.error
  let body: any; try { body = await request.json() } catch { return json({ error: 'Neplatná požiadavka.' }, 400) }
  const admin = createAdminClient()

  if (body.action === 'billing') {
    try {
      const response = await stripe.invoices.list({ limit: 100 })
      return json({ invoices: response.data.map((i:any) => ({ id:i.id,customer:typeof i.customer==='string'?i.customer:i.customer?.id,status:i.status,paid:i.paid,amount_paid:i.amount_paid,amount_due:i.amount_due,currency:i.currency,created:i.created,type:invoiceType(i) })) })
    } catch (error) {
      console.error('Admin billing query failed', error instanceof Error ? error.message : 'unknown')
      return json({ error:'Stripe faktúry sa nepodarilo načítať.' },502)
    }
  }
  if (body.action === 'logs') {
    const { data,error } = await admin.from('admin_audit_logs').select('*').order('created_at',{ascending:false}).limit(200)
    return error ? json({error:'Audit log sa nepodarilo načítať.'},500) : json({logs:data||[]})
  }
  if (body.action === 'integrations') return json({ integrations:{ supabase:true,stripe:Boolean(Deno.env.get('STRIPE_SECRET_KEY')),cloudflare:Boolean(Deno.env.get('CLOUDFLARE_ACCOUNT_ID')&&Deno.env.get('CLOUDFLARE_STREAM_API_TOKEN')) } })

  if (body.action === 'snapshot' || body.action === 'user-detail') {
    const { data: profiles, error } = await admin.from('profiles').select(profileColumns).order('created_at', { ascending: false })
    if (error) return json({ error: 'Profily sa nepodarilo načítať.' }, 500)
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const authMap = new Map((authData?.users || []).map((u) => [u.id, u]))
    const users = (profiles || []).map((p) => { const u = authMap.get(p.id); return { ...p, email:u?.email || null, email_confirmed_at:u?.email_confirmed_at || null, last_sign_in_at:u?.last_sign_in_at || null, banned_until:u?.banned_until || null } })
    if (body.action === 'user-detail') {
      const user = users.find((u) => u.id === body.userId); if (!user) return json({ error:'Používateľ sa nenašiel.' }, 404)
      const { data: history } = await admin.from('watch_history').select('video_id,position_seconds,duration_seconds,progress_percent,completed,last_watched_at').eq('user_id', user.id).order('last_watched_at',{ascending:false}).limit(20)
      let invoices:any[] = []
      if (user.stripe_customer_id) {
        const response = await stripe.invoices.list({ customer:user.stripe_customer_id, limit:20, expand:['data.payment_intent'] })
        invoices = response.data.map((i:any) => ({ id:i.id,status:i.status,paid:i.paid,amount_paid:i.amount_paid,amount_due:i.amount_due,currency:i.currency,created:i.created,type:invoiceType(i) }))
      }
      return json({ user, watchHistory:history || [], invoices })
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
    const { data:before } = await admin.from('videos').select('id,title,published,featured').eq('id',body.videoId).single()
    const { error } = await admin.from('videos').update({ [field]:body.value }).eq('id',body.videoId)
    if (error) return json({error:'Video sa nepodarilo zmeniť.'},500)
    await admin.from('admin_audit_logs').insert({ admin_user_id:auth.user!.id,admin_email:auth.user!.email,action_type:`video.${field}`,entity_type:'video',entity_id:body.videoId,description:`${field} zmenené pre ${before?.title || body.videoId}`,before_data:{[field]:before?.[field]},after_data:{[field]:body.value} })
    return json({ok:true})
  }
  if (body.action === 'save-video') {
    const video = body.video || {}
    if (!video.title || !video.slug || !['free','member','vip'].includes(video.access_level) || !['youtube','stream','cloudflare_stream'].includes(video.provider)) return json({error:'Neplatné údaje videa.'},400)
    const id = String(body.videoId || '')
    const { data:before } = id ? await admin.from('videos').select('id,title,slug,access_level,published,featured,provider').eq('id',id).maybeSingle() : { data:null }
    const query = id ? admin.from('videos').update(video).eq('id',id).select('id').single() : admin.from('videos').insert(video).select('id').single()
    const { data:saved,error } = await query
    if (error) return json({error:error.code==='23505'?'Video s týmto slugom už existuje.':'Video sa nepodarilo uložiť.'},400)
    await admin.from('admin_audit_logs').insert({admin_user_id:auth.user!.id,admin_email:auth.user!.email,action_type:id?'video.update':'video.create',entity_type:'video',entity_id:saved.id,description:`${id?'Upravené':'Vytvorené'} video ${video.title}`,before_data:before,after_data:{title:video.title,slug:video.slug,access_level:video.access_level,published:video.published,featured:video.featured,provider:video.provider}})
    return json({ok:true,id:saved.id})
  }
  return json({ error:'Neplatná operácia.' },400)
})
