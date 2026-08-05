import { supabase } from './supabase'

let latestYouTubePromise = null

export function getLatestYouTubeVideo() {
  if (!supabase) return Promise.reject(new Error('Supabase nie je nakonfigurovaný.'))
  if (!latestYouTubePromise) {
    latestYouTubePromise = supabase.functions.invoke('youtube-latest-video', { method: 'POST' })
      .then(({ data, error }) => {
        if (error || !data?.video) throw error || new Error('Najnovšie YouTube video nie je dostupné.')
        return data.video
      })
      .catch((error) => {
        latestYouTubePromise = null
        throw error
      })
  }
  return latestYouTubePromise
}
