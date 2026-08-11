import { supabase } from './supabase'

export async function videoInteractionsRequest(payload) {
  if (!supabase) throw new Error('Supabase nie je nakonfigurovaný.')
  const { data, error } = await supabase.functions.invoke('video-interactions', { body: payload })
  if (error) throw new Error(data?.error || error.message || 'Interakcie sa nepodarilo načítať.')
  if (data?.error) throw new Error(data.error)
  return data
}
