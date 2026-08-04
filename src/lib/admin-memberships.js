import { supabase } from './supabase'

async function invoke(body) {
  if (!supabase) throw new Error('Supabase nie je nakonfigurovaný.')
  const { data, error } = await supabase.functions.invoke('admin-memberships', { body })
  let message = data?.error
  if (!message && error?.context instanceof Response) {
    try { message = (await error.context.clone().json())?.error } catch { /* response may not contain JSON */ }
  }
  if (error || message) throw new Error(message || error?.message || 'Operácia členstva zlyhala.')
  return data
}

export async function getMembershipUsers() {
  return (await invoke({ action: 'list' })).users || []
}

export async function updateMembership(payload) {
  return (await invoke({ action: 'update', ...payload })).profile
}
