import { supabase } from './supabase'
import { invalidateAdminCache } from './admin-cache'

export async function adminRequest(body) {
  const { data, error } = await supabase.functions.invoke('admin-control-center', { body })
  let message = data?.error
  if (!message && error?.context instanceof Response) { try { message = (await error.context.clone().json())?.error } catch { /* noop */ } }
  if (error || message) throw new Error(message || error?.message || 'Admin operácia zlyhala.')
  if (['save-content','save-video','video-toggle'].includes(body?.action)) invalidateAdminCache('admin-core','admin-content','admin-videos')
  return data
}
