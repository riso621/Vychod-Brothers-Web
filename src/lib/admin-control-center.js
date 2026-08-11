import { supabase } from './supabase'

export async function adminRequest(body) {
  const { data, error } = await supabase.functions.invoke('admin-control-center', { body })
  let message = data?.error
  if (!message && error?.context instanceof Response) { try { message = (await error.context.clone().json())?.error } catch { /* noop */ } }
  if (error || message) throw new Error(message || error?.message || 'Admin operácia zlyhala.')
  return data
}
