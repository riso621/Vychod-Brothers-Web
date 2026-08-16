import { supabase } from './supabase'
import { invalidateAdminCache } from './admin-cache'
import { invalidateSocialStatsCache } from './social-stats'

export async function adminRequest(body) {
  const { data, error } = await supabase.functions.invoke('admin-control-center', { body })
  let message = data?.error
  if (!message && error?.context instanceof Response) { try { message = (await error.context.clone().json())?.error } catch { /* noop */ } }
  if (error || message) throw new Error(message || error?.message || 'Admin operácia zlyhala.')
  if (['save-content','save-video','video-toggle'].includes(body?.action)) invalidateAdminCache('admin-core','admin-content','admin-videos')
  if (body?.action === 'save-social-stats') {
    invalidateAdminCache('admin-social-stats', 'admin-logs', 'admin-core')
    invalidateSocialStatsCache()
  }
  return data
}
