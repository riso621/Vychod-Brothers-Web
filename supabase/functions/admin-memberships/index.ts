import { bearerToken, corsHeaders, json } from '../_shared/http.ts'
import { createAdminClient, createUserClient } from '../_shared/supabase.ts'

const levels = ['free', 'member', 'vip']
const statuses = ['active', 'expired', 'cancelled']

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = bearerToken(request)
  if (!token) return json({ error: 'Prihlásenie je povinné.' }, 401)
  const userClient = createUserClient(token)
  const { data: { user }, error: userError } = await userClient.auth.getUser(token)
  if (userError || !user) return json({ error: 'Prihlásenie nie je platné.' }, 401)
  if (user.app_metadata?.role !== 'admin') return json({ error: 'Nemáte oprávnenie.' }, 403)

  let body: { action?: string; userId?: string; membership?: string; status?: string; expiresAt?: string | null; reason?: string }
  try { body = await request.json() } catch { return json({ error: 'Neplatná požiadavka.' }, 400) }
  if (body.action === 'list') {
    const adminClient = createAdminClient()
    const now = new Date().toISOString()
    await userClient.from('profiles').update({ membership_status: 'expired' })
      .eq('membership_status', 'active').not('membership_expires_at', 'is', null).lte('membership_expires_at', now)
    const { data: profiles, error: profilesError } = await userClient.from('profiles')
      .select('id, username, avatar_url, membership, membership_plan, membership_started_at, membership_expires_at, membership_status, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_subscription_status, stripe_cancel_at_period_end, created_at').order('created_at', { ascending: false })
    if (profilesError) {
      console.error('Membership profiles query failed', profilesError.message)
      return json({ error: 'Členské profily sa nepodarilo načítať.' }, 500)
    }
    const { data: authData, error: authListError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (authListError) console.error('Admin auth users query failed', authListError.message)
    const authUsers = new Map((authData?.users || []).map((authUser) => [authUser.id, authUser]))
    return json({ users: (profiles || []).map((profile) => {
      const authUser = authUsers.get(profile.id)
      return { ...profile, email: authUser?.email || null, email_confirmed_at: authUser?.email_confirmed_at || null, last_sign_in_at: authUser?.last_sign_in_at || null }
    }) })
  }

  if (body.action !== 'update') return json({ error: 'Neplatná operácia.' }, 400)
  const userId = String(body.userId || '')
  const membership = String(body.membership || '')
  const reason = String(body.reason || '').trim()
  let status = String(body.status || '')
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !levels.includes(membership) || !statuses.includes(status)) {
    return json({ error: 'Neplatné údaje členstva.' }, 400)
  }

  let expiresAt: string | null = null
  if (body.expiresAt) {
    const date = new Date(body.expiresAt)
    if (Number.isNaN(date.getTime())) return json({ error: 'Neplatný dátum expirácie.' }, 400)
    expiresAt = date.toISOString()
    if (status === 'active' && date <= new Date()) status = 'expired'
  }

  const { data: current, error: currentError } = await userClient.from('profiles')
    .select('membership, membership_status, membership_started_at, membership_expires_at, stripe_subscription_id').eq('id', userId).maybeSingle()
  if (currentError || !current) return json({ error: 'Profil sa nenašiel.' }, 404)
  if (current.stripe_subscription_id) return json({ error: 'Stripe členstvo nemožno prepísať manuálnym admin zásahom.' }, 409)
  if (reason.length < 5 || membership !== 'free' && !expiresAt) return json({ error: 'Manuálne členstvo vyžaduje dôvod a dátum expirácie.' }, 400)
  const restarting = current.membership !== membership || (current.membership_status !== 'active' && status === 'active')
  const payload = {
    membership,
    membership_status: status,
    membership_expires_at: membership === 'free' ? null : expiresAt,
    membership_started_at: restarting ? new Date().toISOString() : current.membership_started_at,
  }
  const { data, error } = await userClient.from('profiles').update(payload).eq('id', userId)
    .select('id, username, avatar_url, membership, membership_started_at, membership_expires_at, membership_status, created_at').single()
  if (error) return json({ error: 'Členstvo sa nepodarilo aktualizovať.' }, 500)
  const adminClient = createAdminClient()
  await adminClient.from('admin_audit_logs').insert({
    admin_user_id: user.id, admin_email: user.email, action_type: 'membership.manual_update',
    entity_type: 'profile', entity_id: userId, description: reason,
    before_data: { membership: current.membership, membership_status: current.membership_status, membership_expires_at: current.membership_expires_at },
    after_data: { membership: data.membership, membership_status: data.membership_status, membership_expires_at: data.membership_expires_at },
  })
  return json({ profile: data })
})
