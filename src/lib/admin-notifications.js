import { supabase } from './supabase'

export async function adminNotificationsRequest(payload) {
  if (!supabase) throw new Error('Supabase nie je nakonfigurovaný.')
  const { data, error } = await supabase.functions.invoke('admin-notifications', { body: payload })
  if (error) throw new Error(data?.error || error.message || 'Notifikácie sa nepodarilo načítať.')
  if (data?.error) throw new Error(data.error)
  return data
}
